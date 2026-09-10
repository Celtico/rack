import * as Tone from "tone"

import type { SynthNote } from "../../state/pattern"
import type { SynthParams } from "../../state/store"

/** Ramp length for automatable parameter changes. */
const RAMP = 0.03

/**
 * MONO-1: a single `Tone.MonoSynth` on the synth channel.
 *
 * Which parameters ramp and which are plain setters is dictated by Tone:
 *   - resonance → `filter.Q` is a Signal, so it ramps.
 *   - cutoff → `filterEnvelope.baseFrequency` is a plain property. The envelope
 *     owns `filter.frequency`, so this is the only correct place to set it.
 *   - decay, waveform → plain properties; they take effect on the next note.
 */
export class MonoVoice {
  private readonly synth: Tone.MonoSynth

  constructor(output: Tone.ToneAudioNode, p: SynthParams) {
    this.synth = new Tone.MonoSynth({
      volume: -6,
      oscillator: { type: p.waveform },
      filter: { type: "lowpass", rolloff: -24, Q: p.resonance },
      filterEnvelope: {
        attack: 0.005,
        decay: p.decay,
        sustain: 0.1,
        release: 0.2,
        baseFrequency: p.cutoff,
        octaves: 2.5,
      },
      envelope: { attack: 0.005, decay: p.decay, sustain: 0.4, release: 0.15 },
    }).connect(output)
  }

  trigger(note: SynthNote, time: number): void {
    this.synth.triggerAttackRelease(note, "16n", time)
  }

  set<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
    switch (key) {
      case "waveform":
        this.synth.oscillator.type = value as SynthParams["waveform"]
        break
      case "cutoff":
        this.synth.filterEnvelope.baseFrequency = value as number
        break
      case "resonance":
        this.synth.filter.Q.rampTo(value as number, RAMP)
        break
      case "decay":
        this.synth.envelope.decay = value as number
        this.synth.filterEnvelope.decay = value as number
        break
    }
  }

  dispose(): void {
    this.synth.dispose()
  }
}
