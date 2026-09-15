import {
  BASS_RANGES,
  clamp,
  EP_RANGES,
  FILTER_RANGES,
  POLY_RANGES,
  STRINGS_RANGES,
  SYNTH_RANGES,
} from "./params"
import { DRUM_VOICES, PERC_VOICES, type Kind } from "./pattern"

/**
 * Modulation on every machine: tuning, drive, two LFOs, per-step random and
 * four macros. Pure model — ranges, defaults, clamps and the maths the engine
 * and the store share.
 */

export const LFO_SHAPES = ["sine", "triangle", "square", "sawtooth"] as const
export type LfoShape = (typeof LFO_SHAPES)[number]

/** What an LFO or the random source can move. */
export const MOD_TARGETS = ["off", "cutoff", "pitch", "level"] as const
export type ModTarget = (typeof MOD_TARGETS)[number]

export interface LfoParams {
  shape: LfoShape
  /** Hz. */
  rate: number
  target: ModTarget
  /** 0–1 of the target's full swing (`lfoRange`). */
  amount: number
}

export interface RandomParams {
  target: ModTarget
  amount: number
}

/** One thing a macro moves: a parameter key (`macroTargetsFor`) between two values. */
export interface MacroTarget {
  key: string
  min: number
  max: number
}

export interface Macro {
  /** 0–1. */
  value: number
  targets: MacroTarget[]
}

export interface ModParams {
  /** Semitones, applied to every note the machine plays. Melodic kinds only. */
  tune: number
  /** 0–1: how much of a saturation stage the strip runs through. */
  drive: number
  lfo: [LfoParams, LfoParams]
  random: RandomParams
  macros: [Macro, Macro, Macro, Macro]
}

export const MACRO_COUNT = 4
export const LFO_COUNT = 2

export const MOD_RANGES = {
  tune: { min: -12, max: 12 },
  drive: { min: 0, max: 1 },
  rate: { min: 0.05, max: 20 },
  amount: { min: 0, max: 1 },
} as const

const LFO_DEFAULT: LfoParams = { shape: "sine", rate: 1, target: "off", amount: 0.5 }
const MACRO_DEFAULT: Macro = { value: 0, targets: [] }

export const MOD_DEFAULT: ModParams = {
  tune: 0,
  drive: 0,
  lfo: [LFO_DEFAULT, { ...LFO_DEFAULT, rate: 0.25, shape: "triangle" }],
  random: { target: "off", amount: 0.5 },
  macros: [MACRO_DEFAULT, MACRO_DEFAULT, MACRO_DEFAULT, MACRO_DEFAULT],
}

export const defaultMod = (): ModParams => structuredClone(MOD_DEFAULT)

/** Kinds whose notes have a pitch to tune. */
const MELODIC: readonly Kind[] = ["synth", "bass", "poly", "ep", "strings"]
export const hasTune = (kind: Kind): boolean => MELODIC.includes(kind)

/** Kinds whose voices carry a `detune` signal an LFO can reach. */
const DETUNABLE: readonly Kind[] = ["synth", "bass", "poly", "ep"]

/** The targets a kind's LFOs and random source may pick. */
export function modTargetsFor(kind: Kind): ModTarget[] {
  return MOD_TARGETS.filter((t) => t !== "pitch" || DETUNABLE.includes(kind))
}

const clampLfo = (l: LfoParams): LfoParams => ({
  shape: LFO_SHAPES.includes(l.shape) ? l.shape : "sine",
  rate: clamp(l.rate, MOD_RANGES.rate.min, MOD_RANGES.rate.max),
  target: MOD_TARGETS.includes(l.target) ? l.target : "off",
  amount: clamp(l.amount, MOD_RANGES.amount.min, MOD_RANGES.amount.max),
})

const clampMacro = (m: Macro): Macro => ({
  value: clamp(m.value, 0, 1),
  targets: m.targets.map((t) => ({ key: t.key, min: t.min, max: t.max })),
})

export function clampMod(mod: ModParams): ModParams {
  return {
    tune: Math.round(clamp(mod.tune, MOD_RANGES.tune.min, MOD_RANGES.tune.max)),
    drive: clamp(mod.drive, MOD_RANGES.drive.min, MOD_RANGES.drive.max),
    lfo: [clampLfo(mod.lfo[0]), clampLfo(mod.lfo[1])],
    random: {
      target: MOD_TARGETS.includes(mod.random.target) ? mod.random.target : "off",
      amount: clamp(mod.random.amount, MOD_RANGES.amount.min, MOD_RANGES.amount.max),
    },
    macros: [
      clampMacro(mod.macros[0]),
      clampMacro(mod.macros[1]),
      clampMacro(mod.macros[2]),
      clampMacro(mod.macros[3]),
    ],
  }
}

/** A full pitch swing: an octave either way. */
export const PITCH_MOD_CENTS = 1200
/** A full cutoff swing, as a fraction of the cutoff itself either way. */
export const CUTOFF_MOD_FRACTION = 0.9
/** A full level swing, as a fraction of the strip's gain either way. */
export const LEVEL_MOD_FRACTION = 0.9

/**
 * How far a modulator at `amount` swings a target, in the target's own unit
 * (Hz around the cutoff, cents, gain). Symmetric around the knob's value.
 */
export function modSwing(target: ModTarget, amount: number, cutoffHz: number): number {
  switch (target) {
    case "cutoff":
      return amount * CUTOFF_MOD_FRACTION * cutoffHz
    case "pitch":
      return amount * PITCH_MOD_CENTS
    case "level":
      return amount * LEVEL_MOD_FRACTION
    case "off":
      return 0
  }
}

/** A macro's position mapped onto one of its targets. */
export const macroValue = (value: number, t: MacroTarget): number => t.min + (t.max - t.min) * value

/** Something a macro may be assigned to on a kind: a key the store knows how to apply, and its range. */
export interface MacroTargetInfo {
  key: string
  label: string
  min: number
  max: number
}

const range = (
  group: "param" | "filter" | "mod",
  key: string,
  label: string,
  r: { min: number; max: number },
): MacroTargetInfo => ({ key: `${group}:${key}`, label, min: r.min, max: r.max })

const ENV = {
  attack: SYNTH_RANGES.attack,
  decay: SYNTH_RANGES.decay,
  sustain: SYNTH_RANGES.sustain,
  release: SYNTH_RANGES.release,
}

/** The parameters of a kind a macro can move — knobs on the panel, the strip filter, drive and tune. */
export function macroTargetsFor(kind: Kind, stripFilter: boolean): MacroTargetInfo[] {
  const out: MacroTargetInfo[] = []
  switch (kind) {
    case "synth":
      out.push(
        range("param", "cutoff", "Cutoff", SYNTH_RANGES.cutoff),
        range("param", "resonance", "Res", SYNTH_RANGES.resonance),
        range("param", "attack", "Attack", ENV.attack),
        range("param", "decay", "Decay", SYNTH_RANGES.decay),
        range("param", "sustain", "Sustain", ENV.sustain),
        range("param", "release", "Release", ENV.release),
      )
      break
    case "bass":
      out.push(
        range("param", "cutoff", "Cutoff", BASS_RANGES.cutoff),
        range("param", "resonance", "Res", BASS_RANGES.resonance),
        range("param", "envMod", "Env", BASS_RANGES.envMod),
        range("param", "attack", "Attack", BASS_RANGES.attack),
        range("param", "decay", "Decay", BASS_RANGES.decay),
        range("param", "sustain", "Sustain", BASS_RANGES.sustain),
        range("param", "release", "Release", BASS_RANGES.release),
      )
      break
    case "poly":
      out.push(
        range("param", "cutoff", "Cutoff", POLY_RANGES.cutoff),
        range("param", "resonance", "Res", POLY_RANGES.resonance),
        range("param", "attack", "Attack", POLY_RANGES.attack),
        range("param", "decay", "Decay", POLY_RANGES.decay),
        range("param", "sustain", "Sustain", POLY_RANGES.sustain),
        range("param", "release", "Release", POLY_RANGES.release),
      )
      break
    case "ep":
      out.push(
        range("param", "tone", "Tone", EP_RANGES.tone),
        range("param", "bright", "Bright", EP_RANGES.bright),
        range("param", "decay", "Decay", EP_RANGES.decay),
        range("param", "release", "Release", EP_RANGES.release),
      )
      break
    case "strings":
      out.push(
        range("param", "damp", "Damp", STRINGS_RANGES.damp),
        range("param", "sustain", "Sustain", STRINGS_RANGES.sustain),
        range("param", "release", "Release", STRINGS_RANGES.release),
      )
      break
    case "drums":
      for (const v of DRUM_VOICES) out.push(range("param", v, `${v} level`, { min: 0, max: 1 }))
      break
    case "perc":
      for (const v of PERC_VOICES) out.push(range("param", v, `${v} level`, { min: 0, max: 1 }))
      break
    case "sampler":
      break
  }
  if (stripFilter) {
    out.push(
      range("filter", "cutoff", "Filter cutoff", FILTER_RANGES.cutoff),
      range("filter", "resonance", "Filter res", FILTER_RANGES.resonance),
    )
  }
  out.push(range("mod", "drive", "Drive", MOD_RANGES.drive))
  if (hasTune(kind)) out.push(range("mod", "tune", "Tune", MOD_RANGES.tune))
  return out
}

/** What applying a macro changes, grouped the way the store and engine apply things. */
export interface MacroPatches {
  params: Record<string, number>
  filter: Record<string, number>
  mod: Partial<Pick<ModParams, "tune" | "drive">>
}

/** The values every target of `macro` takes at `value`, grouped by where they go. Pure. */
export function macroPatches(macro: Macro, value: number): MacroPatches {
  const out: MacroPatches = { params: {}, filter: {}, mod: {} }
  for (const t of macro.targets) {
    const [group, key] = t.key.split(":") as [string, string]
    const v = macroValue(value, t)
    if (group === "param") out.params[key] = v
    else if (group === "filter") out.filter[key] = v
    else if (group === "mod" && (key === "tune" || key === "drive")) out.mod[key] = v
  }
  return out
}
