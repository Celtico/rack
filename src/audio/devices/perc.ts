import * as Tone from "tone"

import type { PercLevels } from "../../state/params"
import { PERC_VOICES, type PercVoiceId } from "../../state/pattern"
import type { Kit, Voice } from "../types"

/** Ramp length for level changes. */
const RAMP = 0.03

/** 808-style cowbell: two square waves a rough fifth apart. */
const COWBELL_HZ = [587, 845] as const

/**
 * PERC-6 voices. Toms are membrane synths; rim and shaker are filtered noise;
 * the cowbell is two square oscillators through a bandpass; the crash is a
 * metal synth with a long tail. Every voice has its own level gain feeding
 * the perc channel. Nodes are created once, here.
 */
export class PercKit implements Kit<PercVoiceId> {
  private readonly tomLo: Tone.MembraneSynth
  private readonly tomHi: Tone.MembraneSynth
  private readonly rim: Tone.NoiseSynth
  private readonly cowbell: Tone.Synth[]
  private readonly shaker: Tone.NoiseSynth
  private readonly crash: Tone.MetalSynth
  private readonly levels: Record<PercVoiceId, Tone.Gain>
  private readonly filters: Tone.Filter[]

  constructor(output: Tone.ToneAudioNode, initialLevels: PercLevels) {
    this.levels = {} as Record<PercVoiceId, Tone.Gain>
    for (const id of PERC_VOICES) {
      this.levels[id] = new Tone.Gain(initialLevels[id]).connect(output)
    }

    const tom = (decay: number) =>
      new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay, sustain: 0, release: 0.2 },
      })
    this.tomLo = tom(0.35).connect(this.levels.tomLo)
    this.tomHi = tom(0.25).connect(this.levels.tomHi)

    const rimFilter = new Tone.Filter({ type: "bandpass", frequency: 3200, Q: 4 }).connect(
      this.levels.rim,
    )
    this.rim = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    }).connect(rimFilter)

    const cowbellFilter = new Tone.Filter({ type: "bandpass", frequency: 1000, Q: 1.5 }).connect(
      this.levels.cowbell,
    )
    this.cowbell = COWBELL_HZ.map(() =>
      new Tone.Synth({
        volume: -6,
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
      }).connect(cowbellFilter),
    )

    const shakerFilter = new Tone.Filter({ type: "highpass", frequency: 6000 }).connect(
      this.levels.shaker,
    )
    this.shaker = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.01, decay: 0.08, sustain: 0 },
    }).connect(shakerFilter)

    this.crash = new Tone.MetalSynth({
      volume: -14,
      envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 40,
      resonance: 4000,
      octaves: 1.5,
    }).connect(this.levels.crash)

    this.filters = [rimFilter, cowbellFilter, shakerFilter]
  }

  /** The scheduler-facing handle for one voice. */
  voice(id: PercVoiceId): Voice {
    return { trigger: (time) => this.trigger(id, time) }
  }

  trigger(id: PercVoiceId, time: number): void {
    switch (id) {
      case "tomLo":
        this.tomLo.triggerAttackRelease("G1", "8n", time)
        break
      case "tomHi":
        this.tomHi.triggerAttackRelease("D2", "8n", time)
        break
      case "rim":
        this.rim.triggerAttackRelease("64n", time)
        break
      case "cowbell":
        this.cowbell.forEach((osc, i) =>
          osc.triggerAttackRelease(COWBELL_HZ[i] ?? 587, "16n", time),
        )
        break
      case "shaker":
        this.shaker.triggerAttackRelease("32n", time)
        break
      case "crash":
        this.crash.triggerAttackRelease(300, "8n", time)
        break
    }
  }

  setLevel(id: PercVoiceId, level: number): void {
    this.levels[id].gain.rampTo(level, RAMP)
  }

  dispose(): void {
    this.tomLo.dispose()
    this.tomHi.dispose()
    this.rim.dispose()
    for (const osc of this.cowbell) osc.dispose()
    this.shaker.dispose()
    this.crash.dispose()
    for (const f of this.filters) f.dispose()
    for (const g of Object.values(this.levels)) g.dispose()
  }
}
