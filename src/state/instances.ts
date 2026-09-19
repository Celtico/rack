import {
  BASS_PARAMS_DEFAULT,
  BASS_RANGES,
  clamp,
  defaultPads,
  DRUM_LEVELS_DEFAULT,
  EP_PARAMS_DEFAULT,
  EP_RANGES,
  FILTER_DEFAULT,
  FILTER_RANGES,
  PAD_RANGES,
  PERC_LEVELS_DEFAULT,
  POLY_PARAMS_DEFAULT,
  POLY_RANGES,
  STRINGS_PARAMS_DEFAULT,
  STRINGS_RANGES,
  SYNTH_PARAMS_DEFAULT,
  SYNTH_RANGES,
  type BassParams,
  type DrumLevels,
  type EpParams,
  type FilterParams,
  type PadParams,
  type PercLevels,
  type PolyParams,
  type StringsParams,
  type SynthParams,
  type MicParams,
  type SpaceParams,
  type VideoParams,
  MIC_PARAMS_DEFAULT,
  SPACE_DEFAULT,
  SPACE_RANGES,
  MIC_RANGES,
  VIDEO_BARS,
  VIDEO_PARAMS_DEFAULT,
  VIDEO_RANGES,
} from "./params"
import { clampKey, type KeyParams } from "./key"
import { defaultMod, type ModParams } from "./mod"
import { isMelodicKind, KEY_DEFAULT, KINDS, PAD_IDS, type Kind, type PadId } from "./pattern"

/**
 * A machine's key pulled into range, or nothing: a key on a kind without notes is dropped, and
 * so is a missing one (the machine keeps its fixed rows).
 */
export function clampInstanceKey(kind: Kind, key: unknown): KeyParams | undefined {
  if (!isMelodicKind(kind) || typeof key !== "object" || key === null) return undefined
  return clampKey(key as Partial<KeyParams>, KEY_DEFAULT[kind])
}

/** The parameter object of each kind. */
export interface KindParams {
  drums: DrumLevels
  perc: PercLevels
  sampler: Readonly<Record<PadId, PadParams>>
  synth: SynthParams
  bass: BassParams
  poly: PolyParams
  ep: EpParams
  strings: StringsParams
  video: VideoParams
  mic: MicParams
}

/** One machine in the rack: its kind, its parameters and its mixer strip. */
export type Instance = {
  [K in Kind]: {
    id: string
    kind: K
    params: KindParams[K]
    level: number
    send: number
    mute: boolean
    /** Stereo position, −1 left … 1 right; 0 leaves the sound exactly as a mono strip. */
    pan: number
    /** Where it sits in 3D mode (`fx.space`). */
    space: SpaceParams
    /** The strip's filter — only on the kinds without a filter of their own (`hasStripFilter`). */
    filter?: FilterParams
    /** Tuning, drive, LFOs, random and macros — every kind. */
    mod: ModParams
    /**
     * The key whose notes the grid rows are (melodic kinds only, `isMelodicKind`). Absent: the
     * kind's fixed rows from before keys, so older songs sound as they did.
     */
    key?: KeyParams
  }
}[Kind]

/** The kinds whose filter sits on the mixer strip; the synths carry theirs in `params`. */
const STRIP_FILTER_KINDS: readonly Kind[] = ["drums", "perc", "sampler", "ep", "strings"]
export const hasStripFilter = (kind: Kind): boolean => STRIP_FILTER_KINDS.includes(kind)

export const clampFilter = (f: FilterParams): FilterParams => ({
  type: f.type,
  cutoff: clamp(f.cutoff, FILTER_RANGES.cutoff.min, FILTER_RANGES.cutoff.max),
  resonance: clamp(f.resonance, FILTER_RANGES.resonance.min, FILTER_RANGES.resonance.max),
})

export type InstanceOf<K extends Kind> = Extract<Instance, { kind: K }>

/** Panel model name per kind. */
export const KIND_MODEL: Readonly<Record<Kind, string>> = {
  drums: "DR-4",
  perc: "PERC-6",
  sampler: "SMP-8",
  synth: "MONO-1",
  bass: "BASS-2",
  poly: "POLY-4",
  ep: "EP-1",
  strings: "STR-6",
  video: "VID-1",
  mic: "MIC-1",
}

export const KIND_TITLE: Readonly<Record<Kind, string>> = {
  drums: "Drum machine",
  perc: "Percussion",
  sampler: "Sampler",
  synth: "Mono synth",
  bass: "Acid bass",
  poly: "Poly pad",
  ep: "Piano",
  strings: "Guitar",
  video: "Video loop",
  mic: "Microphone",
}

const MIX_DEFAULT: Readonly<Record<Kind, { level: number; send: number }>> = {
  drums: { level: 0.9, send: 0.15 },
  perc: { level: 0.8, send: 0.25 },
  sampler: { level: 0.85, send: 0.2 },
  synth: { level: 0.8, send: 0.35 },
  bass: { level: 0.85, send: 0.15 },
  poly: { level: 0.7, send: 0.4 },
  ep: { level: 0.75, send: 0.35 },
  strings: { level: 0.7, send: 0.3 },
  video: { level: 0.8, send: 0.2 },
  mic: { level: 0.8, send: 0.2 },
}

export function defaultParams<K extends Kind>(kind: K): KindParams[K] {
  const table: { [P in Kind]: () => KindParams[P] } = {
    drums: () => DRUM_LEVELS_DEFAULT,
    perc: () => PERC_LEVELS_DEFAULT,
    sampler: () => defaultPads(),
    synth: () => SYNTH_PARAMS_DEFAULT,
    bass: () => BASS_PARAMS_DEFAULT,
    poly: () => POLY_PARAMS_DEFAULT,
    ep: () => EP_PARAMS_DEFAULT,
    strings: () => STRINGS_PARAMS_DEFAULT,
    video: () => VIDEO_PARAMS_DEFAULT,
    mic: () => MIC_PARAMS_DEFAULT,
  }
  return table[kind]()
}

type Ranges<T> = { [K in keyof T]?: { min: number; max: number } }

function clampFields<T extends object>(params: T, ranges: Ranges<T>): T {
  const out = { ...params }
  for (const key of Object.keys(ranges) as (keyof T)[]) {
    const range = ranges[key]
    const value = out[key]
    if (range && typeof value === "number")
      out[key] = clamp(value, range.min, range.max) as T[keyof T]
  }
  return out
}

function clampLevels<T extends Record<string, number>>(levels: T): T {
  const out = { ...levels } as Record<string, number>
  for (const k of Object.keys(out)) out[k] = clamp(out[k] ?? 0, 0, 1)
  return out as T
}

/** Every numeric field pulled into its declared range. Unknown keys are dropped. */
export function clampParams<K extends Kind>(kind: K, params: KindParams[K]): KindParams[K] {
  switch (kind) {
    case "drums":
    case "perc":
      return clampLevels(params as Record<string, number>) as KindParams[K]
    case "sampler": {
      const pads = params as KindParams["sampler"]
      const out = {} as Record<PadId, PadParams>
      for (const id of PAD_IDS) out[id] = clampFields(pads[id], PAD_RANGES)
      return out as KindParams[K]
    }
    // Defaults underneath, so a params object from before a field existed gets it.
    case "synth":
      return clampFields(
        { ...SYNTH_PARAMS_DEFAULT, ...(params as SynthParams) },
        SYNTH_RANGES,
      ) as KindParams[K]
    case "bass":
      return clampFields(
        { ...BASS_PARAMS_DEFAULT, ...(params as BassParams) },
        BASS_RANGES,
      ) as KindParams[K]
    case "poly":
      return clampFields(
        { ...POLY_PARAMS_DEFAULT, ...(params as PolyParams) },
        POLY_RANGES,
      ) as KindParams[K]
    case "ep":
      return clampFields(params as EpParams, EP_RANGES) as KindParams[K]
    case "strings":
      return clampFields(
        { ...STRINGS_PARAMS_DEFAULT, ...(params as StringsParams) },
        STRINGS_RANGES,
      ) as KindParams[K]
    case "video": {
      const v = clampFields({ ...VIDEO_PARAMS_DEFAULT, ...(params as VideoParams) }, VIDEO_RANGES)
      return {
        ...v,
        bars: VIDEO_BARS.includes(v.bars) ? v.bars : VIDEO_PARAMS_DEFAULT.bars,
      } as KindParams[K]
    }
    case "mic": {
      const m = clampFields({ ...MIC_PARAMS_DEFAULT, ...(params as MicParams) }, MIC_RANGES)
      return {
        ...m,
        bars: Number.isFinite(m.bars) ? Math.round(m.bars) : MIC_PARAMS_DEFAULT.bars,
        live: m.live === true,
      } as KindParams[K]
    }
  }
  return params
}

/** `drums-3` → 3. */
function instanceNumber(id: string): number {
  return Number(id.slice(id.lastIndexOf("-") + 1)) || 1
}

/** Next free id for a kind: `${kind}-${n}` with n above every existing one. */
function nextInstanceId(kind: Kind, existing: readonly Instance[]): string {
  const taken = existing.filter((i) => i.kind === kind).map((i) => instanceNumber(i.id))
  return `${kind}-${(taken.length ? Math.max(...taken) : 0) + 1}`
}

export function createInstance(kind: Kind, existing: readonly Instance[]): Instance {
  return {
    id: nextInstanceId(kind, existing),
    kind,
    params: defaultParams(kind),
    level: MIX_DEFAULT[kind].level,
    send: MIX_DEFAULT[kind].send,
    mute: false,
    pan: 0,
    space: { ...SPACE_DEFAULT },
    ...(hasStripFilter(kind) ? { filter: { ...FILTER_DEFAULT } } : {}),
    mod: defaultMod(),
  } as Instance
}

/** A 3D position pulled into range; anything missing (older songs) is the default. */
export const clampSpace = (space: Partial<SpaceParams> | undefined): SpaceParams => ({
  angle: clamp(space?.angle ?? SPACE_DEFAULT.angle, SPACE_RANGES.angle.min, SPACE_RANGES.angle.max),
  distance: clamp(
    space?.distance ?? SPACE_DEFAULT.distance,
    SPACE_RANGES.distance.min,
    SPACE_RANGES.distance.max,
  ),
})

/** One of each kind — the factory rack. */
export function defaultInstances(): Instance[] {
  const out: Instance[] = []
  for (const kind of KINDS) out.push(createInstance(kind, out))
  return out
}

/** "DR-4", or "DR-4 #2" once there is more than one of that kind. */
export function instanceLabel(inst: Instance, all: readonly Instance[]): string {
  const siblings = all.filter((i) => i.kind === inst.kind)
  const model = KIND_MODEL[inst.kind]
  return siblings.length > 1 ? `${model} #${instanceNumber(inst.id)}` : model
}
