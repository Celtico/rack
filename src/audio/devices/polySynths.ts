import * as Tone from "tone"

import type { EpParams, PolyParams, StringsParams } from "../../state/params"
import { fatOscillator } from "./oscillators"

/** Ramp length for automatable parameter changes. */
const RAMP = 0.03
/** Pad unison: three oscillators well spread, then a slow chorus. */
const UNISON = { count: 3, spread: 24 }

/** Something that plays chords from the grid. */
export interface PolyInstrument {
  trigger: (notes: string[], time: number) => void
  dispose: () => void
}

/**
 * POLY-4: a subtractive pad — `PolySynth` of unison `Synth` voices into one
 * shared 24 dB lowpass and a slow chorus. Chords are held a quarter note;
 * sustain and release shape the rest.
 */
export class PolyPad implements PolyInstrument {
  private readonly synth: Tone.PolySynth<Tone.Synth>
  private readonly filter: Tone.Filter
  private readonly chorus: Tone.Chorus

  constructor(output: Tone.ToneAudioNode, p: PolyParams) {
    this.chorus = new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.6, wet: 0.35 })
      .connect(output)
      .start()
    this.filter = new Tone.Filter({
      type: "lowpass",
      frequency: p.cutoff,
      rolloff: -24,
      Q: 1.2,
    }).connect(this.chorus)
    this.synth = new Tone.PolySynth(Tone.Synth, {
      volume: -14,
      oscillator: fatOscillator(p.waveform, UNISON.count, UNISON.spread),
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
    }).connect(this.filter)
    this.synth.maxPolyphony = 8
  }

  trigger(notes: string[], time: number): void {
    this.synth.triggerAttackRelease(notes, "4n", time)
  }

  set<K extends keyof PolyParams>(key: K, value: PolyParams[K]): void {
    switch (key) {
      case "waveform":
        this.synth.set({
          oscillator: fatOscillator(value as PolyParams["waveform"], UNISON.count, UNISON.spread),
        })
        break
      case "cutoff":
        this.filter.frequency.rampTo(value as number, RAMP)
        break
      default:
        this.synth.set({ envelope: { [key]: value as number } })
    }
  }

  dispose(): void {
    this.synth.dispose()
    this.filter.dispose()
    this.chorus.dispose()
  }
}

/**
 * EP-1: a two-operator FM electric piano. The modulation envelope decays
 * faster than the amp envelope, so every note starts with a bright bark and
 * settles into a sine — the classic tine.
 */
export class EPiano implements PolyInstrument {
  private readonly synth: Tone.PolySynth<Tone.FMSynth>

  constructor(output: Tone.ToneAudioNode, p: EpParams) {
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      volume: -10,
      harmonicity: p.tone,
      modulationIndex: p.bright,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.005, decay: p.decay, sustain: 0.05, release: p.release },
      modulationEnvelope: { attack: 0.005, decay: 0.35, sustain: 0.1, release: 0.5 },
    }).connect(output)
    this.synth.maxPolyphony = 8
  }

  trigger(notes: string[], time: number): void {
    this.synth.triggerAttackRelease(notes, "4n", time)
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
    for (const note of notes) {
      const string = this.strings[this.next % STRING_COUNT]
      this.next = (this.next + 1) % STRING_COUNT
      string?.triggerAttackRelease(note, "8n", time)
    }
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
