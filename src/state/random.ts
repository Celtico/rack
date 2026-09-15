import { defaultParams, type Instance, type KindParams } from "./instances"
import { hasTune, MOD_RANGES, type ModParams } from "./mod"
import {
  BASS_RANGES,
  BASS_WAVEFORMS,
  EP_RANGES,
  FILTER_RANGES,
  FILTER_TYPES,
  POLY_RANGES,
  STRINGS_RANGES,
  SYNTH_RANGES,
  VIDEO_RANGES,
  WAVEFORMS,
  type FilterParams,
  type FilterType,
} from "./params"
import { DRUM_VOICES, PERC_VOICES, type Kind } from "./pattern"

/** A source of numbers in [0, 1) — `Math.random` in the app, something fixed in a test. */
export type Rng = () => number

type Range = { readonly min: number; readonly max: number }

const uniform = (rng: Rng, r: Range) => r.min + (r.max - r.min) * rng()
/** Evenly across octaves — for frequencies and times, where the ear is logarithmic. */
const logUniform = (rng: Rng, r: Range) => r.min * (r.max / r.min) ** rng()
const pick = <T>(rng: Rng, options: readonly T[]): T => options[Math.floor(rng() * options.length)]!

/** Levels a random kit lands on: never off, never quite full. */
const LEVEL_RANGE = { min: 0.45, max: 1 }
/** Random drive stays tasteful. */
const DRIVE_RANGE = { min: 0, max: 0.6 }

/**
 * A new sound for a kind: every knob somewhere sensible in its range. Pure —
 * the rng decides everything. Sampler pads keep their samples and settings.
 */
export function randomParams<K extends Kind>(kind: K, rng: Rng): KindParams[K] {
  switch (kind) {
    case "drums":
      return Object.fromEntries(
        DRUM_VOICES.map((v) => [v, uniform(rng, LEVEL_RANGE)]),
      ) as KindParams[K]
    case "perc":
      return Object.fromEntries(
        PERC_VOICES.map((v) => [v, uniform(rng, LEVEL_RANGE)]),
      ) as KindParams[K]
    case "sampler":
      return defaultParams(kind)
    case "synth":
      return {
        waveform: pick(rng, WAVEFORMS),
        filterType: pick(rng, FILTER_TYPES),
        cutoff: logUniform(rng, SYNTH_RANGES.cutoff),
        resonance: uniform(rng, { min: SYNTH_RANGES.resonance.min, max: 12 }),
        attack: logUniform(rng, { min: SYNTH_RANGES.attack.min, max: 0.3 }),
        decay: logUniform(rng, SYNTH_RANGES.decay),
        sustain: uniform(rng, SYNTH_RANGES.sustain),
        release: logUniform(rng, { min: SYNTH_RANGES.release.min, max: 1.5 }),
      } as KindParams[K]
    case "bass":
      return {
        waveform: pick(rng, BASS_WAVEFORMS),
        filterType: pick(rng, ["lowpass", "lowpass", "bandpass"] as const),
        cutoff: logUniform(rng, BASS_RANGES.cutoff),
        resonance: uniform(rng, { min: 1, max: 16 }),
        envMod: uniform(rng, BASS_RANGES.envMod),
        attack: BASS_RANGES.attack.min,
        decay: logUniform(rng, BASS_RANGES.decay),
        sustain: uniform(rng, { min: 0, max: 0.5 }),
        release: logUniform(rng, { min: BASS_RANGES.release.min, max: 0.4 }),
      } as KindParams[K]
    case "poly":
      return {
        waveform: pick(rng, WAVEFORMS),
        filterType: pick(rng, FILTER_TYPES),
        cutoff: logUniform(rng, POLY_RANGES.cutoff),
        resonance: uniform(rng, { min: POLY_RANGES.resonance.min, max: 8 }),
        attack: logUniform(rng, POLY_RANGES.attack),
        decay: logUniform(rng, POLY_RANGES.decay),
        sustain: uniform(rng, POLY_RANGES.sustain),
        release: logUniform(rng, POLY_RANGES.release),
      } as KindParams[K]
    case "ep":
      return {
        tone: uniform(rng, EP_RANGES.tone),
        bright: uniform(rng, EP_RANGES.bright),
        decay: logUniform(rng, EP_RANGES.decay),
        release: logUniform(rng, EP_RANGES.release),
      } as KindParams[K]
    case "strings":
      return {
        damp: logUniform(rng, STRINGS_RANGES.damp),
        sustain: uniform(rng, STRINGS_RANGES.sustain),
        release: logUniform(rng, STRINGS_RANGES.release),
      } as KindParams[K]
    case "video":
      return {
        ...defaultParams(kind),
        ...randomSynthFilter("video", rng),
        toCutoff: uniform(rng, VIDEO_RANGES.toCutoff),
      } as KindParams[K]
  }
  return defaultParams(kind)
}

/** A random setting for a synth's own filter (MONO-1, BASS-2, POLY-4): type, cutoff and Q in its ranges. */
export function randomSynthFilter(
  kind: "synth" | "bass" | "poly" | "video",
  rng: Rng,
): { filterType: FilterType; cutoff: number; resonance: number } {
  const ranges =
    kind === "synth"
      ? SYNTH_RANGES
      : kind === "bass"
        ? BASS_RANGES
        : kind === "poly"
          ? POLY_RANGES
          : VIDEO_RANGES
  return {
    filterType:
      kind === "bass"
        ? pick(rng, ["lowpass", "lowpass", "bandpass"] as const)
        : pick(rng, FILTER_TYPES),
    cutoff: logUniform(rng, ranges.cutoff),
    resonance: uniform(rng, { min: ranges.resonance.min, max: kind === "bass" ? 16 : 10 }),
  }
}

/** A random strip filter — mostly open, so a kit is not silenced by a stray highpass. */
export function randomFilter(rng: Rng): FilterParams {
  const type = pick(rng, ["lowpass", "lowpass", "lowpass", "highpass", "bandpass"] as const)
  const cutoff =
    type === "highpass"
      ? logUniform(rng, { min: FILTER_RANGES.cutoff.min, max: 600 })
      : logUniform(rng, { min: 800, max: FILTER_RANGES.cutoff.max })
  return { type, cutoff, resonance: uniform(rng, { min: FILTER_RANGES.resonance.min, max: 6 }) }
}

/** Tune and drive at random; the LFOs, random source and macros are left as they are. */
export function randomMod(kind: Kind, mod: ModParams, rng: Rng): ModParams {
  return {
    ...mod,
    tune: hasTune(kind)
      ? Math.round(uniform(rng, { min: -MOD_RANGES.tune.max / 2, max: MOD_RANGES.tune.max / 2 }))
      : 0,
    drive: uniform(rng, DRIVE_RANGE),
  }
}

/** The instance with a new sound: params, strip filter (when it has one), tune and drive. */
export function randomizeInstance(inst: Instance, rng: Rng): Instance {
  return {
    ...inst,
    // A sampler's pads are its samples, a VID-1's file and loop length are its own: kept.
    params:
      inst.kind === "sampler"
        ? inst.params
        : inst.kind === "video"
          ? {
              ...randomParams(inst.kind, rng),
              videoName: inst.params.videoName,
              bars: inst.params.bars,
              start: inst.params.start,
              end: inst.params.end,
            }
          : randomParams(inst.kind, rng),
    ...(inst.filter ? { filter: randomFilter(rng) } : {}),
    mod: randomMod(inst.kind, inst.mod, rng),
  } as Instance
}
