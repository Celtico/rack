import { CHANNEL_IDS } from "./channels"
import {
  BASS_PARAMS_DEFAULT,
  BASS_WAVEFORMS,
  DELAY_TIMES,
  EP_PARAMS_DEFAULT,
  MIX_DEFAULT,
  PERC_LEVELS_DEFAULT,
  POLY_PARAMS_DEFAULT,
  STRINGS_PARAMS_DEFAULT,
  WAVEFORMS,
  type BassParams,
  type DrumLevels,
  type EpParams,
  type FxParams,
  type MixParams,
  type PercLevels,
  type PolyParams,
  type StringsParams,
  type SynthParams,
} from "./params"
import {
  BASS_NOTES,
  DRUM_VOICES,
  kitRows,
  noteRow,
  PERC_VOICES,
  POLY_INSTRUMENTS,
  POLY_NOTES,
  polyRow,
  STEP_COUNT,
  SYNTH_NOTES,
  type BassRow,
  type KitRows,
  type Pattern,
  type PolyInstrumentId,
  type PolyRow,
  type SynthRow,
} from "./pattern"
import { MAX_CHAIN, PATTERN_COUNT } from "./patterns"

export const SONG_VERSION = 1

/**
 * Everything worth saving. Transport position and playing state are not.
 * Fields added after the first release (swing, perc, bass, the poly
 * instruments) are optional on read so older files keep loading.
 */
export interface Song {
  version: typeof SONG_VERSION
  bpm: number
  swing: number
  masterVolume: number
  patterns: Pattern[]
  activePattern: number
  chain: number[]
  drumLevels: DrumLevels
  percLevels: PercLevels
  synthParams: SynthParams
  bassParams: BassParams
  polyParams: PolyParams
  epParams: EpParams
  stringsParams: StringsParams
  mix: MixParams
  fx: FxParams
}

export class SongParseError extends Error {
  override name = "SongParseError"
}

const fail = (path: string, expected: string): never => {
  throw new SongParseError(`${path}: expected ${expected}`)
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

const num = (v: unknown, path: string): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fail(path, "a finite number")

const int = (v: unknown, path: string, max: number): number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < max
    ? (v as number)
    : fail(path, `an integer in [0, ${max})`)

const oneOf = <T extends string>(v: unknown, path: string, options: readonly T[]): T =>
  options.includes(v as T) ? (v as T) : fail(path, `one of ${options.join(", ")}`)

const record = (v: unknown, path: string): Record<string, unknown> =>
  isRecord(v) ? v : fail(path, "an object")

const list = (v: unknown, path: string, length?: number): unknown[] => {
  if (!Array.isArray(v)) return fail(path, "an array")
  if (length !== undefined && v.length !== length) return fail(path, `${length} items`)
  return v
}

const boolRow = (v: unknown, path: string): boolean[] =>
  list(v, path, STEP_COUNT).map((on, i) =>
    typeof on === "boolean" ? on : fail(`${path}[${i}]`, "a boolean"),
  )

const monoRow = (v: unknown, path: string, rows: number): SynthRow =>
  list(v, path, STEP_COUNT).map((r, i) => (r === null ? null : int(r, `${path}[${i}]`, rows)))

const chordRow = (v: unknown, path: string, rows: number): PolyRow =>
  list(v, path, STEP_COUNT).map((column, i) =>
    [
      ...new Set(list(column, `${path}[${i}]`).map((r, j) => int(r, `${path}[${i}][${j}]`, rows))),
    ].sort((a, b) => a - b),
  )

/** One on/off row per voice. A kit missing from the file (older song) gets empty rows. */
function parseKitRows<Id extends string>(
  v: unknown,
  path: string,
  ids: readonly Id[],
): KitRows<Id> {
  if (v === undefined) return kitRows(ids)
  const obj = record(v, path)
  const out = {} as Record<Id, boolean[]>
  for (const id of ids) out[id] = boolRow(obj[id], `${path}.${id}`)
  return out
}

function parseBassRow(v: unknown, path: string): BassRow {
  if (v === undefined) {
    return { notes: noteRow(), accent: kitRows(["a"]).a, slide: kitRows(["s"]).s }
  }
  const obj = record(v, path)
  return {
    notes: monoRow(obj.notes, `${path}.notes`, BASS_NOTES.length),
    accent: boolRow(obj.accent, `${path}.accent`),
    slide: boolRow(obj.slide, `${path}.slide`),
  }
}

function parsePolyRows(v: unknown, path: string): Record<PolyInstrumentId, PolyRow> {
  const obj = v === undefined ? {} : record(v, path)
  const out = {} as Record<PolyInstrumentId, PolyRow>
  for (const id of POLY_INSTRUMENTS) {
    out[id] =
      obj[id] === undefined ? polyRow() : chordRow(obj[id], `${path}.${id}`, POLY_NOTES[id].length)
  }
  return out
}

function parsePattern(v: unknown, path: string): Pattern {
  const p = record(v, path)
  return {
    drums: parseKitRows(p.drums, `${path}.drums`, DRUM_VOICES),
    perc: parseKitRows(p.perc, `${path}.perc`, PERC_VOICES),
    synth: monoRow(p.synth, `${path}.synth`, SYNTH_NOTES.length),
    bass: parseBassRow(p.bass, `${path}.bass`),
    poly: parsePolyRows(p.poly, `${path}.poly`),
  }
}

/**
 * A keyed record of numbers. When `defaults` is given, a missing object or a
 * missing key falls back to it — that is how songs saved before a channel or
 * kit existed keep loading.
 */
function parseNumbers<K extends string>(
  v: unknown,
  path: string,
  keys: readonly K[],
  defaults?: Readonly<Record<K, number>>,
): Record<K, number> {
  const obj = v === undefined && defaults ? {} : record(v, path)
  const out = {} as Record<K, number>
  for (const k of keys) out[k] = num(obj[k] ?? defaults?.[k], `${path}.${k}`)
  return out
}

/** A params object whose numeric fields are required but that may be absent altogether. */
function parseParams<T extends object>(
  v: unknown,
  path: string,
  defaults: T,
  enums: Partial<Record<keyof T, readonly string[]>> = {},
): T {
  if (v === undefined) return { ...defaults }
  const obj = record(v, path)
  const out = { ...defaults } as Record<string, unknown>
  for (const key of Object.keys(defaults)) {
    const options = (enums as Record<string, readonly string[] | undefined>)[key]
    out[key] = options
      ? oneOf(obj[key], `${path}.${key}`, options)
      : num(obj[key], `${path}.${key}`)
  }
  return out as T
}

/** Strict on shape, lenient on ranges — the store clamps numbers when it applies the song. */
export function parseSong(text: string): Song {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SongParseError("not valid JSON")
  }
  const s = record(raw, "song")
  if (s.version !== SONG_VERSION) fail("song.version", String(SONG_VERSION))

  const synth = record(s.synthParams, "song.synthParams")
  const mix = record(s.mix, "song.mix")
  const fx = record(s.fx, "song.fx")

  return {
    version: SONG_VERSION,
    bpm: num(s.bpm, "song.bpm"),
    swing: num(s.swing ?? 0, "song.swing"),
    masterVolume: num(s.masterVolume, "song.masterVolume"),
    patterns: list(s.patterns, "song.patterns", PATTERN_COUNT).map((p, i) =>
      parsePattern(p, `song.patterns[${i}]`),
    ),
    activePattern: int(s.activePattern, "song.activePattern", PATTERN_COUNT),
    chain: list(s.chain, "song.chain")
      .slice(0, MAX_CHAIN)
      .map((c, i) => int(c, `song.chain[${i}]`, PATTERN_COUNT)),
    drumLevels: parseNumbers(s.drumLevels, "song.drumLevels", DRUM_VOICES),
    percLevels: parseNumbers(s.percLevels, "song.percLevels", PERC_VOICES, PERC_LEVELS_DEFAULT),
    synthParams: {
      waveform: oneOf(synth.waveform, "song.synthParams.waveform", WAVEFORMS),
      cutoff: num(synth.cutoff, "song.synthParams.cutoff"),
      resonance: num(synth.resonance, "song.synthParams.resonance"),
      decay: num(synth.decay, "song.synthParams.decay"),
    },
    bassParams: parseParams(s.bassParams, "song.bassParams", BASS_PARAMS_DEFAULT, {
      waveform: BASS_WAVEFORMS,
    }),
    polyParams: parseParams(s.polyParams, "song.polyParams", POLY_PARAMS_DEFAULT, {
      waveform: WAVEFORMS,
    }),
    epParams: parseParams(s.epParams, "song.epParams", EP_PARAMS_DEFAULT),
    stringsParams: parseParams(s.stringsParams, "song.stringsParams", STRINGS_PARAMS_DEFAULT),
    mix: {
      level: parseNumbers(mix.level, "song.mix.level", CHANNEL_IDS, MIX_DEFAULT.level),
      send: parseNumbers(mix.send, "song.mix.send", CHANNEL_IDS, MIX_DEFAULT.send),
    },
    fx: {
      delayTime: oneOf(fx.delayTime, "song.fx.delayTime", DELAY_TIMES),
      feedback: num(fx.feedback, "song.fx.feedback"),
      reverbDecay: num(fx.reverbDecay, "song.fx.reverbDecay"),
    },
  }
}

export function serializeSong(song: Song): string {
  return JSON.stringify(song, null, 2)
}
