import * as Tone from "tone"

import { DRUM_VOICES, type DrumVoiceId } from "../../state/pattern"
import type { DrumLevels } from "../../state/store"
import { RAMP, type Kit, type Voice } from "../types"

/** Clap flam: three noise bursts a few ms apart, the last one carrying the tail. */
const CLAP_BURSTS = [0, 0.012, 0.024]

/**
 * DR-4 voices. Kick is a membrane synth into a little drive; snare and clap are
 * filtered noise (the snare adds a short membrane body under the noise); the
 * hat is a metal synth. Every voice has its
 * own level gain feeding the drums channel. Nodes are created once, here.
 */
export class DrumKit implements Kit<DrumVoiceId> {
  private readonly kick: Tone.MembraneSynth
  private readonly snareNoise: Tone.NoiseSynth
  private readonly snareBody: Tone.MembraneSynth
  private readonly clap: Tone.NoiseSynth
  private readonly hat: Tone.MetalSynth
  private readonly levels: Record<DrumVoiceId, Tone.Gain>
  private readonly filters: (Tone.Filter | Tone.Distortion)[]

  constructor(output: Tone.ToneAudioNode, initialLevels: DrumLevels) {
    this.levels = Object.fromEntries(
      DRUM_VOICES.map((id) => [id, new Tone.Gain(initialLevels[id]).connect(output)]),
    ) as Record<DrumVoiceId, Tone.Gain>

    // Kick: a longer sine drop into a touch of saturation, which adds the harmonics a
    // clean sine lacks on small speakers.
    const kickDrive = new Tone.Distortion({ distortion: 0.3, wet: 0.45 }).connect(this.levels.kick)
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.3 },
    }).connect(kickDrive)

    const snareFilter = new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 0.8 }).connect(
      this.levels.snare,
    )
    this.snareNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
    }).connect(snareFilter)
    this.snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 3,
      volume: -8,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
    }).connect(this.levels.snare)

    const clapFilter = new Tone.Filter({ type: "bandpass", frequency: 1200, Q: 1 }).connect(
      this.levels.clap,
    )
    this.clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    }).connect(clapFilter)

    // Hat: six detuned square oscillators through FM (the 808 recipe) instead of filtered
    // noise — metallic rather than hissy.
    const hatFilter = new Tone.Filter({ type: "highpass", frequency: 6000 }).connect(
      this.levels.hat,
    )
    this.hat = new Tone.MetalSynth({
      volume: -14,
      envelope: { attack: 0.001, decay: 0.07, release: 0.03 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 6500,
      octaves: 1.2,
    }).connect(hatFilter)

    this.filters = [snareFilter, clapFilter, hatFilter, kickDrive]
  }

  /** The scheduler-facing handle for one voice. */
  voice(id: DrumVoiceId): Voice {
    return { trigger: (time) => this.trigger(id, time) }
  }

  trigger(id: DrumVoiceId, time: number): void {
    switch (id) {
      case "kick":
        this.kick.triggerAttackRelease("C1", "8n", time)
        break
      case "snare":
        this.snareNoise.triggerAttackRelease("16n", time)
        this.snareBody.triggerAttackRelease("G2", "16n", time, 0.7)
        break
      case "clap":
        for (const offset of CLAP_BURSTS) {
          this.clap.triggerAttackRelease("32n", time + offset)
        }
        break
      case "hat":
        this.hat.triggerAttackRelease(250, "32n", time)
        break
    }
  }

  setLevel(id: DrumVoiceId, level: number): void {
    this.levels[id].gain.rampTo(level, RAMP)
  }

  dispose(): void {
    this.kick.dispose()
    this.snareNoise.dispose()
    this.snareBody.dispose()
    this.clap.dispose()
    this.hat.dispose()
    for (const f of this.filters) f.dispose()
    for (const g of Object.values(this.levels)) g.dispose()
  }
}
