import type { ChannelId } from "./channels"
import type { DrumVoiceId, PercVoiceId } from "./pattern"

export const BPM_MIN = 40
export const BPM_MAX = 240
export const BPM_DEFAULT = 120

export const MASTER_DEFAULT = 0.8

export type DrumLevels = Readonly<Record<DrumVoiceId, number>>
export type PercLevels = Readonly<Record<PercVoiceId, number>>

export const DRUM_LEVELS_DEFAULT: DrumLevels = { kick: 0.9, snare: 0.7, clap: 0.6, hat: 0.5 }
export const PERC_LEVELS_DEFAULT: PercLevels = {
  tomLo: 0.7,
  tomHi: 0.6,
  rim: 0.5,
  cowbell: 0.4,
  shaker: 0.4,
  crash: 0.5,
}

export const WAVEFORMS = ["sawtooth", "square", "triangle", "sine"] as const
export type Waveform = (typeof WAVEFORMS)[number]

export interface SynthParams {
  waveform: Waveform
  /** Filter cutoff, Hz. */
  cutoff: number
  /** Filter Q. */
  resonance: number
  /** Amp and filter envelope decay, seconds. */
  decay: number
}

export const SYNTH_RANGES = {
  cutoff: { min: 80, max: 8000 },
  resonance: { min: 0.1, max: 20 },
  decay: { min: 0.02, max: 2 },
} as const

export const SYNTH_PARAMS_DEFAULT: SynthParams = {
  waveform: "sawtooth",
  cutoff: 1200,
  resonance: 2,
  decay: 0.25,
}

export const BASS_WAVEFORMS = ["sawtooth", "square"] as const
export type BassWaveform = (typeof BASS_WAVEFORMS)[number]

export interface BassParams {
  waveform: BassWaveform
  /** Filter cutoff, Hz. */
  cutoff: number
  /** Filter Q. */
  resonance: number
  /** Filter envelope depth, 0–1. */
  envMod: number
  /** Envelope decay, seconds. */
  decay: number
}

export const BASS_RANGES = {
  cutoff: { min: 80, max: 5000 },
  resonance: { min: 0.1, max: 20 },
  envMod: { min: 0, max: 1 },
  decay: { min: 0.02, max: 1 },
} as const

export const BASS_PARAMS_DEFAULT: BassParams = {
  waveform: "sawtooth",
  cutoff: 320,
  resonance: 9,
  envMod: 0.6,
  decay: 0.22,
}

/** Per-channel level into the master bus and send into the FX bus, both 0–1. */
export interface MixParams {
  level: Readonly<Record<ChannelId, number>>
  send: Readonly<Record<ChannelId, number>>
}

export const MIX_DEFAULT: MixParams = {
  level: { drums: 0.9, perc: 0.8, synth: 0.8, bass: 0.85 },
  send: { drums: 0.15, perc: 0.25, synth: 0.35, bass: 0.15 },
}

/** Echo time in transport notation, so it follows the tempo. */
export const DELAY_TIMES = ["16n", "8n", "8n.", "4n"] as const
export type DelayTime = (typeof DELAY_TIMES)[number]

export interface FxParams {
  delayTime: DelayTime
  /** Echo feedback, 0–0.9. */
  feedback: number
  /** Reverb tail, seconds. */
  reverbDecay: number
}

export const FX_RANGES = {
  feedback: { min: 0, max: 0.9 },
  reverbDecay: { min: 0.1, max: 10 },
} as const

export const FX_DEFAULT: FxParams = {
  delayTime: "8n.",
  feedback: 0.35,
  reverbDecay: 2.5,
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Clamp every value of a keyed record to [min, max]. */
export function clampRecord<Id extends string>(
  ids: readonly Id[],
  values: Readonly<Record<Id, number>>,
  min: number,
  max: number,
): Record<Id, number> {
  const out = {} as Record<Id, number>
  for (const id of ids) out[id] = clamp(values[id], min, max)
  return out
}
