import * as Tone from "tone"

import type { SynthParams } from "../../state/store"
import { RAMP, transposeNote, type ModHooks } from "../types"
import { fatOscillator } from "./oscillators"

/** Three oscillators spread wide: a lead with some air around it. */
const UNISON = { count: 3, spread: 18 }

/**
 * MONO-1: a single `Tone.MonoSynth` on the synth channel.
 *
 * Which parameters ramp and which are plain setters is dictated by Tone:
 *   - resonance → `filter.Q` is a Signal, so it ramps.
 *   - cutoff → `filterEnvelope.baseFrequency` is a plain property. The envelope
 *     owns `filter.frequency`, so this is the only correct place to set it.
 *   - decay, waveform → plain properties; they take effect on the next note.
 */
export class MonoVoice implements ModHooks {
  private readonly synth: Tone.MonoSynth
  private tune = 0

  constructor(output: Tone.ToneAudioNode, p: SynthParams) {
    this.synth = new Tone.MonoSynth({
      volume: -6,
      oscillator: fatOscillator(p.waveform, UNISON.count, UNISON.spread),
      filter: { type: p.filterType, rolloff: -24, Q: p.resonance },
      filterEnvelope: {
        attack: 0.005,
        decay: p.decay,
        sustain: 0.1,
        release: 0.2,
        baseFrequency: p.cutoff,
        octaves: 2.5,
      },
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
    }).connect(output)
  }

  trigger(note: string, time: number): void {
    this.synth.triggerAttackRelease(transposeNote(note, this.tune), "16n", time)
  }

  setTune(semitones: number): void {
    this.tune = semitones
  }

  /** The envelope drives it; a modulator connected here sums with the envelope. */
  cutoffInput(): Tone.Signal<"frequency"> {
    return this.synth.filter.frequency
  }

  pitchInputs(): Tone.Signal<"cents">[] {
    return [this.synth.detune]
  }

  set<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
    switch (key) {
      case "waveform":
        this.synth.set({
          oscillator: fatOscillator(value as SynthParams["waveform"], UNISON.count, UNISON.spread),
        })
        break
      case "filterType":
        // A plain property on the BiquadFilters; it takes effect at once.
        this.synth.filter.type = value as SynthParams["filterType"]
        break
      case "cutoff":
        this.synth.filterEnvelope.baseFrequency = value as number
        break
      case "resonance":
        this.synth.filter.Q.rampTo(value as number, RAMP)
        break
      case "attack":
        this.synth.envelope.attack = value as number
        break
      case "decay":
        this.synth.envelope.decay = value as number
        this.synth.filterEnvelope.decay = value as number
        break
      case "sustain":
        this.synth.envelope.sustain = value as number
        break
      case "release":
        this.synth.envelope.release = value as number
        break
    }
  }

  dispose(): void {
    this.synth.dispose()
  }
}
