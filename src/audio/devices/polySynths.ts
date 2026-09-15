import * as Tone from "tone"

import type { EpParams, PolyParams, StringsParams } from "../../state/params"
import { transposeNote, type ModHooks } from "../types"
import { fatOscillator } from "./oscillators"

/** Ramp length for automatable parameter changes. */
const RAMP = 0.03
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
export interface PolyInstrument extends ModHooks {
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
      case "filterType":
        this.filter.type = value as PolyParams["filterType"]
        break
      case "cutoff":
        this.cutoff.rampTo(value as number, RAMP)
        break
      case "resonance":
        this.filter.Q.rampTo(value as number, RAMP)
        break
      default:
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
 * STR-6: Karplus–Strong plucked strings. `PluckSynth` is monophonic and not a
 * `Monophonic`, so `PolySynth` cannot host it — a pool of six, allocated
 * round-robin, does the job and matches the name.
 */
export class Strings implements PolyInstrument {
  private readonly strings: Tone.PluckSynth[]
  private next = 0
  private tune = 0

  constructor(output: Tone.ToneAudioNode, p: StringsParams) {
    this.strings = Array.from({ length: STRING_COUNT }, () =>
      new Tone.PluckSynth({
        volume: -6,
        attackNoise: 1,
        dampening: p.damp,
        resonance: p.sustain,
        release: p.release,
      }).connect(output),
    )
  }

  trigger(notes: string[], time: number): void {
    // A column lit past six notes keeps its first six: the seventh would land on a string
    // already struck at this very time, which Tone refuses ("start time must be strictly
    // greater") — live it lost the rest of the step, in an export it failed the render.
    for (const note of notes.slice(0, STRING_COUNT)) {
      const string = this.strings[this.next % STRING_COUNT]
      this.next = (this.next + 1) % STRING_COUNT
      string?.triggerAttackRelease(transposeNote(note, this.tune), "8n", time)
    }
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
    for (const s of this.strings) {
      switch (key) {
        case "damp":
          s.dampening = value
          break
        case "sustain":
          s.resonance = value
          break
        case "release":
          s.release = value
          break
      }
    }
  }

  dispose(): void {
    for (const s of this.strings) s.dispose()
  }
}
