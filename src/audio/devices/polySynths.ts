import * as Tone from "tone"

import type { EpParams, PolyParams, StringsParams, StringsSound } from "../../state/params"
import {
  fetchGuitarSample,
  GUITAR_NOTES,
  isSampledSound,
  type SampledSound,
} from "../guitarSamples"
import { RAMP, transposeNote, type ModHooks } from "../types"
import { setFilterParam } from "./gate"
import { fatOscillator } from "./oscillators"

/** Pad unison: three oscillators well spread, then a slow chorus. */
const UNISON = { count: 3, spread: 24 }
/**
 * Voices per polyphonic machine. Tone's `PolySynth` hands every struck note
 * a fresh voice and gives it back only once the note has died away — a chord
 * a beat with a two-second release keeps a dozen alive — and past its limit
 * it *drops* notes ("Max polyphony exceeded"), heard as the part cutting out.
 * So the machines here keep their own pool instead: a fixed set of voices
 * allocated round-robin, and when none is free the oldest is struck again —
 * what a hardware polysynth does. The pool also bounds the CPU on a phone.
 */
const PAD_VOICES = 8
const EP_VOICES = 12

/** A monophonic Tone voice the pool can hold. */
interface PoolVoice {
  triggerAttackRelease(note: string, duration: string, time: number): unknown
  set(options: Record<string, unknown>): unknown
  connect(destination: Tone.InputNode): unknown
  dispose(): unknown
}

/**
 * A fixed set of voices dealt round-robin. Re-striking a voice that still
 * sounds restarts its envelopes (Tone cancels the release it had scheduled),
 * so a busy part never loses a note, only the tail of an old one.
 */
class VoicePool<V extends PoolVoice> {
  readonly voices: V[]
  /** When each voice was last struck: Tone refuses a restart at or before the previous start. */
  private readonly struck: number[]
  private next = 0

  constructor(count: number, make: () => V, output: Tone.InputNode) {
    this.voices = Array.from({ length: count }, () => {
      const voice = make()
      voice.connect(output)
      return voice
    })
    this.struck = this.voices.map(() => -1)
  }

  trigger(notes: string[], duration: string, time: number): void {
    for (const note of notes) {
      const i = this.next
      this.next = (this.next + 1) % this.voices.length
      // A voice wrapped back to within the same tick (a stall replayed several steps at one
      // time) is struck a hair later rather than thrown out by Tone.
      const at = this.struck[i]! >= time ? this.struck[i]! + 0.001 : time
      this.struck[i] = at
      this.voices[i]!.triggerAttackRelease(note, duration, at)
    }
  }

  set(options: Record<string, unknown>): void {
    for (const voice of this.voices) voice.set(options)
  }

  dispose(): void {
    for (const voice of this.voices) voice.dispose()
  }
}

/** Something that plays chords from the grid. */
interface PolyInstrument extends ModHooks {
  trigger: (notes: string[], time: number) => void
  dispose: () => void
}

/**
 * POLY-4: a subtractive pad — a pool of unison `Synth` voices into one
 * shared 24 dB lowpass and a slow chorus. Chords are held a quarter note;
 * sustain and release shape the rest.
 */
export class PolyPad implements PolyInstrument {
  private readonly synth: VoicePool<Tone.Synth>
  private readonly filter: Tone.Filter
  /** The cutoff as a signal into the filter, so modulators can sum with it (a Tone signal input overrides the param's own value). */
  private readonly cutoff: Tone.Signal<"frequency">
  private readonly chorus: Tone.Chorus
  private tune = 0

  constructor(output: Tone.ToneAudioNode, p: PolyParams) {
    this.chorus = new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.6, wet: 0.35 })
      .connect(output)
      .start()
    this.filter = new Tone.Filter({
      type: p.filterType,
      rolloff: -24,
      Q: p.resonance,
    }).connect(this.chorus)
    this.cutoff = new Tone.Signal({ value: p.cutoff, units: "frequency" })
    this.cutoff.connect(this.filter.frequency)
    this.synth = new VoicePool(
      PAD_VOICES,
      () =>
        new Tone.Synth({
          volume: -14,
          oscillator: fatOscillator(p.waveform, UNISON.count, UNISON.spread),
          envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
        }),
      this.filter,
    )
  }

  trigger(notes: string[], time: number): void {
    this.synth.trigger(
      notes.map((n) => transposeNote(n, this.tune)),
      "4n",
      time,
    )
  }

  setTune(semitones: number): void {
    this.tune = semitones
  }

  cutoffInput(): Tone.Signal<"frequency"> {
    return this.filter.frequency
  }

  pitchInputs(): Tone.Signal<"cents">[] {
    return this.synth.voices.map((v) => v.detune)
  }

  set<K extends keyof PolyParams>(key: K, value: PolyParams[K]): void {
    switch (key) {
      case "waveform":
        this.synth.set({
          oscillator: fatOscillator(value as PolyParams["waveform"], UNISON.count, UNISON.spread),
        })
        break
      default:
        if (!setFilterParam(this.filter, this.cutoff, key, value))
          this.synth.set({ envelope: { [key]: value as number } })
    }
  }

  dispose(): void {
    this.synth.dispose()
    this.cutoff.dispose()
    this.filter.dispose()
    this.chorus.dispose()
  }
}

/**
 * EP-1: a two-operator FM electric piano, a pool of `FMSynth` voices. The
 * modulation envelope decays faster than the amp envelope, so every note
 * starts with a bright bark and settles into a sine — the classic tine.
 */
export class EPiano implements PolyInstrument {
  private readonly synth: VoicePool<Tone.FMSynth>
  private tune = 0

  constructor(output: Tone.ToneAudioNode, p: EpParams) {
    this.synth = new VoicePool(
      EP_VOICES,
      () =>
        new Tone.FMSynth({
          volume: -10,
          harmonicity: p.tone,
          modulationIndex: p.bright,
          oscillator: { type: "sine" },
          modulation: { type: "sine" },
          envelope: { attack: 0.005, decay: p.decay, sustain: 0.05, release: p.release },
          modulationEnvelope: { attack: 0.005, decay: 0.35, sustain: 0.1, release: 0.5 },
        }),
      output,
    )
  }

  /** An eighth: the tine is percussive (sustain 0.05), so the hold hardly shows. */
  trigger(notes: string[], time: number): void {
    this.synth.trigger(
      notes.map((n) => transposeNote(n, this.tune)),
      "8n",
      time,
    )
  }

  setTune(semitones: number): void {
    this.tune = semitones
  }

  /** No filter of its own: the strip's does the work. */
  cutoffInput(): null {
    return null
  }

  pitchInputs(): Tone.Signal<"cents">[] {
    return this.synth.voices.map((v) => v.detune)
  }

  set<K extends keyof EpParams>(key: K, value: EpParams[K]): void {
    switch (key) {
      case "tone":
        this.synth.set({ harmonicity: value })
        break
      case "bright":
        this.synth.set({ modulationIndex: value })
        break
      case "decay":
      case "release":
        this.synth.set({ envelope: { [key]: value } })
        break
    }
  }

  dispose(): void {
    this.synth.dispose()
  }
}

/** STR-6 has six strings. */
const STRING_COUNT = 6

/**
 * The sampled guitars are recordings normalised to −1 dBFS; six of them in a strum add up, so
 * they come in well under the plucks' −4 dB. Measured on Sol solet with `render-check`: at −9 dB
 * the nylon guitar rendered 2.5 dB RMS over the model, at −11 it matches within a decibel.
 */
const SAMPLED_VOLUME = -11

/** The Damp knob (500–8000 Hz) over a recording: a lowpass that is all but open at the default. */
const dampToCutoff = (damp: number): number => Math.min(16000, damp * 2.5)

/**
 * STR-6: a sampled guitar — a `Tone.Sampler` over CC0 recordings of a nylon-string or an
 * electric guitar, every note repitched from the nearest one — or, as the "model" sound, the
 * Karplus–Strong plucked strings it began with. `PluckSynth` is monophonic and not a
 * `Monophonic`, so `PolySynth` cannot host it — a pool of six, allocated round-robin, does the
 * job and matches the name. Either way a chord is strummed one string at a time.
 */
export class Strings implements PolyInstrument {
  private readonly output: Tone.ToneAudioNode
  private sound: StringsSound
  /** The recordings, once `loadSound` has fetched them; the model plays until they are in. */
  private sampler: Tone.Sampler | null = null
  /** The Damp knob over the sampled sound. */
  private samplerFilter: Tone.Filter | null = null
  private samplerReady = false
  private loading: Promise<void> = Promise.resolve()
  private damp: number
  private release: number
  private readonly strings: Tone.PluckSynth[]
  /**
   * Under the plucks, the same notes on a soft triangle with a short decay: a plucked string
   * model is all attack and no fundamental, and this is the weight of the wood it lacks.
   */
  private readonly wood: Tone.Synth[]
  private readonly woodFilter: Tone.Filter
  /**
   * The guitar's body: a little warmth around 240 Hz, the rumble under 80 Hz taken out (on the low
   * strings the plucks and the wood voice piled up into mud there), and the plastic top of a plain
   * pluck taken off.
   */
  private readonly body: Tone.Filter
  private readonly floor: Tone.Filter
  private readonly top: Tone.Filter
  private next = 0
  private tune = 0
  private strum: number
  /** Down-strokes and up-strokes alternate: low string first, then high string first. */
  private down = true

  constructor(output: Tone.ToneAudioNode, p: StringsParams) {
    this.output = output
    this.sound = p.sound
    this.damp = p.damp
    this.release = p.release
    this.strum = p.strum
    if (isSampledSound(p.sound)) this.loadSound(p.sound)
    this.top = new Tone.Filter({ type: "lowpass", frequency: 5000, rolloff: -12 }).connect(output)
    this.floor = new Tone.Filter({ type: "highpass", frequency: 80, rolloff: -12 }).connect(
      this.top,
    )
    this.body = new Tone.Filter({ type: "peaking", frequency: 240, Q: 0.9, gain: 3 }).connect(
      this.floor,
    )
    this.strings = Array.from({ length: STRING_COUNT }, () =>
      new Tone.PluckSynth({
        volume: -4,
        // How long the burst that plucks the string lasts (Tone's `attackNoise` is a duration, not an
        // amount): shortened, the pluck is a click and the string a drum.
        attackNoise: 1,
        dampening: p.damp,
        resonance: p.sustain,
        release: p.release,
      }).connect(this.body),
    )
    this.woodFilter = new Tone.Filter({ type: "lowpass", frequency: 900, rolloff: -12 }).connect(
      this.body,
    )
    // One voice per string, taken over by the next strike like the string itself: a chug on every
    // sixteenth never runs out of voices (a `PolySynth` of twelve dropped notes).
    this.wood = Array.from({ length: STRING_COUNT }, () =>
      new Tone.Synth({
        volume: -20,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.004, decay: 1.2, sustain: 0.1, release: 0.6 },
      }).connect(this.woodFilter),
    )
  }

  /**
   * Fetch a sampled guitar's notes into a fresh sampler (the previous one goes with its buffers),
   * each decoded through the sampler's own context — an offline render decodes into its own graph.
   * The bytes are shared across instances and renders (`fetchGuitarSample`). A note that fails
   * leaves the others in; the sampler is used once every fetch has settled and something loaded.
   */
  private loadSound(sound: SampledSound): void {
    this.disposeSampler()
    const filter = new Tone.Filter({
      type: "lowpass",
      frequency: dampToCutoff(this.damp),
      rolloff: -12,
    }).connect(this.output)
    const sampler = new Tone.Sampler({
      attack: 0.002,
      release: this.release,
      volume: SAMPLED_VOLUME,
    }).connect(filter)
    this.sampler = sampler
    this.samplerFilter = filter
    this.loading = Promise.allSettled(
      GUITAR_NOTES[sound].map(async (note) => {
        const data = await fetchGuitarSample(sound, note)
        const decoded = await sampler.context.decodeAudioData(data.slice(0))
        if (this.sampler === sampler) sampler.add(note as Tone.Unit.Note, decoded)
        return true
      }),
    ).then((results) => {
      if (this.sampler === sampler)
        this.samplerReady = results.some((r) => r.status === "fulfilled")
    })
  }

  private disposeSampler(): void {
    this.samplerReady = false
    this.sampler?.dispose()
    this.samplerFilter?.dispose()
    this.sampler = null
    this.samplerFilter = null
  }

  /** Resolves once the sampled sound's recordings are in (at once for the model): a render waits for it. */
  ready(): Promise<void> {
    return this.loading
  }

  /**
   * A chord as a hand strums it: the strings one after another, `strum` ms apart, low to
   * high on one stroke and high to low on the next, each a hair off in pitch and force so no
   * two strikes are the same. A column lit past six notes keeps its first six: the seventh
   * would land on a string already struck at this very time, which Tone refuses ("start time
   * must be strictly greater") — live it lost the rest of the step, in an export it failed the render.
   */
  trigger(notes: string[], time: number): void {
    const sorted = notes
      .slice(0, STRING_COUNT)
      .map((note) => transposeNote(note, this.tune))
      .sort((a, b) => Tone.Frequency(a).toMidi() - Tone.Frequency(b).toMidi())
    const order = this.down ? sorted : sorted.reverse()
    this.down = !this.down
    // The whole strum stays inside a sixteenth at any tempo the rack allows.
    const spacing = Math.min(this.strum, 60 / Math.max(1, order.length - 1)) / 1000
    // The recordings, once they are in; the model until then, and always as the "model" sound.
    const sampled = this.sound !== "model" && this.samplerReady ? this.sampler : null
    order.forEach((note, i) => {
      const cents = (Math.random() * 2 - 1) * 4
      const hz = Tone.Frequency(note).toFrequency() * 2 ** (cents / 1200)
      const at = time + i * spacing
      const velocity = 0.8 + Math.random() * 0.2
      if (sampled) {
        // A recording rings on its own; held a bar like a string, the release only ends what
        // nothing struck again. The sampler gives every strike a fresh buffer source.
        sampled.triggerAttackRelease(hz, "1m", at, velocity)
        return
      }
      const string = this.strings[this.next % STRING_COUNT]
      const wood = this.wood[this.next % STRING_COUNT]
      this.next = (this.next + 1) % STRING_COUNT
      // Held a whole bar: a strummed string rings until the next strike takes it, and the release
      // (a ramp of the loop's resonance to nothing) only ends what nothing struck again.
      string?.triggerAttackRelease(hz, "1m", at, velocity)
      wood?.triggerAttackRelease(hz, "8n", at, velocity)
    })
  }

  setTune(semitones: number): void {
    this.tune = semitones
  }

  cutoffInput(): null {
    return null
  }

  /** A plucked string has no detune signal to bend. */
  pitchInputs(): Tone.Signal<"cents">[] {
    return []
  }

  set<K extends keyof StringsParams>(key: K, value: StringsParams[K]): void {
    switch (key) {
      case "strum":
        this.strum = value as number
        return
      case "sound": {
        const sound = value as StringsSound
        if (sound === this.sound) return
        this.sound = sound
        if (isSampledSound(sound)) this.loadSound(sound)
        else this.disposeSampler()
        return
      }
      case "damp":
        this.damp = value as number
        this.samplerFilter?.frequency.rampTo(dampToCutoff(this.damp), RAMP)
        break
      case "release":
        this.release = value as number
        if (this.sampler) this.sampler.release = this.release
        break
    }
    for (const s of this.strings) {
      switch (key) {
        case "damp":
          s.dampening = value as number
          break
        case "sustain":
          s.resonance = value as number
          break
        case "release":
          s.release = value as number
          break
      }
    }
  }

  dispose(): void {
    this.disposeSampler()
    for (const s of this.strings) s.dispose()
    for (const w of this.wood) w.dispose()
    this.woodFilter.dispose()
    this.body.dispose()
    this.floor.dispose()
    this.top.dispose()
  }
}
