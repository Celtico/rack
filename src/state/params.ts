import type { ChannelId } from "./channels"
import type { DrumVoiceId } from "./pattern"

export const BPM_MIN = 40
export const BPM_MAX = 240
export const BPM_DEFAULT = 120

export const MASTER_DEFAULT = 0.8

export type DrumLevels = Readonly<Record<DrumVoiceId, number>>

export const DRUM_LEVELS_DEFAULT: DrumLevels = { kick: 0.9, snare: 0.7, clap: 0.6, hat: 0.5 }

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

/** Per-channel level into the master bus and send into the FX bus, both 0–1. */
export interface MixParams {
  level: Readonly<Record<ChannelId, number>>
  send: Readonly<Record<ChannelId, number>>
}

export const MIX_DEFAULT: MixParams = {
  level: { drums: 0.9, synth: 0.8 },
  send: { drums: 0.15, synth: 0.35 },
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
