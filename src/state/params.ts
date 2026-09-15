import { PAD_IDS, type DrumVoiceId, type PadId, type PercVoiceId } from "./pattern"

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

/** One SMP-8 pad. The audio itself lives in IndexedDB; the song keeps only this. */
export interface PadParams {
  /** File name shown on the panel, or null while the pad is empty. */
  name: string | null
  /** Transposition in semitones. */
  pitch: number
  /** Seconds the sample plays before it is cut. */
  decay: number
  level: number
}

export const PAD_RANGES = {
  pitch: { min: -12, max: 12 },
  decay: { min: 0.05, max: 4 },
  level: { min: 0, max: 1 },
} as const

export const PAD_DEFAULT: PadParams = { name: null, pitch: 0, decay: 1, level: 0.8 }

export function defaultPads(): Record<PadId, PadParams> {
  const out = {} as Record<PadId, PadParams>
  for (const id of PAD_IDS) out[id] = { ...PAD_DEFAULT }
  return out
}

export const WAVEFORMS = ["sawtooth", "square", "triangle", "sine"] as const
export type Waveform = (typeof WAVEFORMS)[number]

/** The shapes a synth's filter can take — `BiquadFilterType` names, as Tone wants them. */
export const FILTER_TYPES = ["lowpass", "highpass", "bandpass", "notch"] as const
export type FilterType = (typeof FILTER_TYPES)[number]

/**
 * The filter every machine without one of its own gets on its strip (kits,
 * sampler, EP-1, STR-6): type, cutoff and resonance, like a synth's.
 */
export interface FilterParams {
  type: FilterType
  cutoff: number
  resonance: number
}

export const FILTER_RANGES = {
  cutoff: { min: 40, max: 20000 },
  resonance: { min: 0.1, max: 20 },
} as const

/** Wide open: a lowpass at the top of hearing with no peak passes the sound as it is. */
export const FILTER_DEFAULT: FilterParams = { type: "lowpass", cutoff: 20000, resonance: 0.1 }

export interface SynthParams {
  waveform: Waveform
  filterType: FilterType
  /** Filter cutoff, Hz. */
  cutoff: number
  /** Filter Q. */
  resonance: number
  /** Amp envelope attack, seconds. */
  attack: number
  /** Amp and filter envelope decay, seconds. */
  decay: number
  /** Amp envelope sustain, 0–1. */
  sustain: number
  /** Amp envelope release, seconds. */
  release: number
}

export const SYNTH_RANGES = {
  cutoff: { min: 80, max: 8000 },
  resonance: { min: 0.1, max: 20 },
  attack: { min: 0.001, max: 2 },
  decay: { min: 0.02, max: 2 },
  sustain: { min: 0, max: 1 },
  release: { min: 0.02, max: 4 },
} as const

export const SYNTH_PARAMS_DEFAULT: SynthParams = {
  waveform: "sawtooth",
  filterType: "lowpass",
  cutoff: 1200,
  resonance: 2,
  attack: 0.005,
  decay: 0.25,
  sustain: 0.4,
  release: 0.15,
}

export const BASS_WAVEFORMS = ["sawtooth", "square"] as const
export type BassWaveform = (typeof BASS_WAVEFORMS)[number]

export interface BassParams {
  waveform: BassWaveform
  filterType: FilterType
  /** Filter cutoff, Hz. */
  cutoff: number
  /** Filter Q. */
  resonance: number
  /** Filter envelope depth, 0–1. */
  envMod: number
  /** Amp envelope attack, seconds. */
  attack: number
  /** Envelope decay, seconds. */
  decay: number
  /** Amp envelope sustain, 0–1. */
  sustain: number
  /** Amp envelope release, seconds. */
  release: number
}

export const BASS_RANGES = {
  cutoff: { min: 80, max: 5000 },
  resonance: { min: 0.1, max: 20 },
  envMod: { min: 0, max: 1 },
  attack: { min: 0.001, max: 1 },
  decay: { min: 0.02, max: 1 },
  sustain: { min: 0, max: 1 },
  release: { min: 0.02, max: 2 },
} as const

export const BASS_PARAMS_DEFAULT: BassParams = {
  waveform: "sawtooth",
  filterType: "lowpass",
  cutoff: 320,
  resonance: 9,
  envMod: 0.6,
  attack: 0.003,
  decay: 0.22,
  sustain: 0.25,
  release: 0.08,
}

/** POLY-4: a subtractive pad. */
export interface PolyParams {
  waveform: Waveform
  filterType: FilterType
  cutoff: number
  /** Filter Q. */
  resonance: number
  attack: number
  decay: number
  sustain: number
  release: number
}

export const POLY_RANGES = {
  cutoff: { min: 80, max: 12000 },
  resonance: { min: 0.1, max: 20 },
  attack: { min: 0.005, max: 2 },
  decay: { min: 0.02, max: 2 },
  sustain: { min: 0, max: 1 },
  release: { min: 0.02, max: 4 },
} as const

export const POLY_PARAMS_DEFAULT: PolyParams = {
  waveform: "sawtooth",
  filterType: "lowpass",
  cutoff: 2200,
  resonance: 1.2,
  attack: 0.02,
  decay: 0.3,
  sustain: 0.6,
  release: 0.6,
}

/** EP-1: a two-operator FM electric piano. */
export interface EpParams {
  /** Carrier:modulator ratio — the timbre. */
  tone: number
  /** Modulation index — how much bite the attack has. */
  bright: number
  decay: number
  release: number
}

export const EP_RANGES = {
  tone: { min: 0.5, max: 4 },
  bright: { min: 0, max: 20 },
  decay: { min: 0.1, max: 4 },
  release: { min: 0.05, max: 3 },
} as const

export const EP_PARAMS_DEFAULT: EpParams = { tone: 2, bright: 6, decay: 1.6, release: 0.8 }

/** STR-6: six plucked strings (Karplus–Strong). */
export interface StringsParams {
  /** Dampening filter, Hz — lower is darker. */
  damp: number
  /** String resonance, 0.8–0.999 — how long it rings. */
  sustain: number
  release: number
}

export const STRINGS_RANGES = {
  damp: { min: 500, max: 8000 },
  sustain: { min: 0.8, max: 0.999 },
  release: { min: 0.05, max: 3 },
} as const

export const STRINGS_PARAMS_DEFAULT: StringsParams = { damp: 3200, sustain: 0.97, release: 1 }

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
