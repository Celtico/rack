import { defaultParams, type Instance } from "./instances"
import { BASS_WAVEFORMS, DELAY_TIMES, WAVEFORMS, type FxParams } from "./params"
import {
  BASS_NOTES,
  emptyTrack,
  KINDS,
  KIT_VOICES,
  kitRows,
  PAD_IDS,
  POLY_NOTES,
  STEP_COUNT,
  SYNTH_NOTES,
  type BassRow,
  type Kind,
  type KitKind,
  type KitRows,
  type Pattern,
  type PolyKind,
  type PolyRow,
  type SynthRow,
  type Track,
} from "./pattern"
import { MAX_CHAIN, padBank, PATTERN_COUNT } from "./patterns"
import { parseSongV1 } from "./songV1"

export const SONG_VERSION = 2

/**
 * Everything worth saving. Transport position and playing state are not.
 * Sample audio is not here either — it stays in the browser's IndexedDB.
 */
export interface Song {
  version: typeof SONG_VERSION
  bpm: number
  swing: number
  masterVolume: number
  instances: Instance[]
  patterns: Pattern[]
  activePattern: number
  chain: number[]
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

const bool = (v: unknown, path: string): boolean =>
  typeof v === "boolean" ? v : fail(path, "a boolean")

const str = (v: unknown, path: string): string =>
  typeof v === "string" && v.length > 0 ? v : fail(path, "a non-empty string")

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

/** Between one and PATTERN_COUNT patterns; shorter banks are padded by the caller. */
export const bank = (v: unknown): unknown[] => {
  const items = list(v, "song.patterns")
  if (items.length < 1 || items.length > PATTERN_COUNT)
    fail("song.patterns", `1 to ${PATTERN_COUNT} items`)
  return items
}

const boolRow = (v: unknown, path: string): boolean[] =>
  list(v, path, STEP_COUNT).map((on, i) => bool(on, `${path}[${i}]`))

const monoRow = (v: unknown, path: string, rows: number): SynthRow =>
  list(v, path, STEP_COUNT).map((r, i) => (r === null ? null : int(r, `${path}[${i}]`, rows)))

const chordRow = (v: unknown, path: string, rows: number): PolyRow =>
  list(v, path, STEP_COUNT).map((column, i) =>
    [
      ...new Set(list(column, `${path}[${i}]`).map((r, j) => int(r, `${path}[${i}][${j}]`, rows))),
    ].sort((a, b) => a - b),
  )

function parseKitRows(v: unknown, path: string, kind: KitKind): KitRows {
  if (v === undefined) return kitRows(KIT_VOICES[kind])
  const obj = record(v, path)
  const out: Record<string, boolean[]> = {}
  for (const id of KIT_VOICES[kind]) out[id] = boolRow(obj[id], `${path}.${id}`)
  return out
}

function parseBassRow(v: unknown, path: string): BassRow {
  const obj = record(v, path)
  return {
    notes: monoRow(obj.notes, `${path}.notes`, BASS_NOTES.length),
    accent: boolRow(obj.accent, `${path}.accent`),
    slide: boolRow(obj.slide, `${path}.slide`),
  }
}

/** A track of a known kind. A missing track (instance added after the file was saved) is silent. */
function parseTrack(v: unknown, path: string, kind: Kind): Track {
  if (v === undefined) return emptyTrack(kind)
  const t = record(v, path)
  if (t.kind !== kind) fail(`${path}.kind`, kind)
  switch (kind) {
    case "drums":
    case "perc":
    case "sampler":
      return { kind, rows: parseKitRows(t.rows, `${path}.rows`, kind) } as Track
    case "synth":
      return { kind, notes: monoRow(t.notes, `${path}.notes`, SYNTH_NOTES.length) }
    case "bass":
      return { kind, bass: parseBassRow(t.bass, `${path}.bass`) }
    case "poly":
    case "ep":
    case "strings":
      return {
        kind,
        chords: chordRow(t.chords, `${path}.chords`, POLY_NOTES[kind].length),
      } as Track
  }
}

/** Numeric params validated against the kind's defaults; enum fields checked against their lists. */
function parseParams(v: unknown, path: string, kind: Kind): Instance["params"] {
  const defaults = defaultParams(kind) as Record<string, unknown>
  const obj = v === undefined ? {} : record(v, path)
  if (kind === "sampler") {
    const out: Record<string, unknown> = {}
    for (const id of PAD_IDS) {
      const d = defaults[id] as Record<string, unknown>
      const pad = obj[id] === undefined ? {} : record(obj[id], `${path}.${id}`)
      const name = pad.name ?? null
      out[id] = {
        name: name === null ? null : str(name, `${path}.${id}.name`),
        pitch: num(pad.pitch ?? d.pitch, `${path}.${id}.pitch`),
        decay: num(pad.decay ?? d.decay, `${path}.${id}.decay`),
        level: num(pad.level ?? d.level, `${path}.${id}.level`),
      }
    }
    return out as Instance["params"]
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(defaults)) {
    const value = obj[key] ?? defaults[key]
    if (key === "waveform") {
      out[key] = oneOf(value, `${path}.${key}`, kind === "bass" ? BASS_WAVEFORMS : WAVEFORMS)
    } else {
      out[key] = num(value, `${path}.${key}`)
    }
  }
  return out as Instance["params"]
}

function parseInstance(v: unknown, path: string): Instance {
  const obj = record(v, path)
  const kind = oneOf(obj.kind, `${path}.kind`, KINDS)
  return {
    id: str(obj.id, `${path}.id`),
    kind,
    params: parseParams(obj.params, `${path}.params`, kind),
    level: num(obj.level, `${path}.level`),
    send: num(obj.send, `${path}.send`),
    mute: bool(obj.mute ?? false, `${path}.mute`),
  } as Instance
}

function parseSongV2(s: Record<string, unknown>): Song {
  const instances = list(s.instances, "song.instances").map((i, n) =>
    parseInstance(i, `song.instances[${n}]`),
  )
  const ids = new Set(instances.map((i) => i.id))
  if (ids.size !== instances.length) fail("song.instances", "unique ids")
  const fx = record(s.fx, "song.fx")

  return {
    version: SONG_VERSION,
    bpm: num(s.bpm, "song.bpm"),
    swing: num(s.swing ?? 0, "song.swing"),
    masterVolume: num(s.masterVolume, "song.masterVolume"),
    instances,
    patterns: padBank(
      bank(s.patterns).map((p, n) => {
        const tracks = record(record(p, `song.patterns[${n}]`).tracks, `song.patterns[${n}].tracks`)
        return {
          tracks: Object.fromEntries(
            instances.map((i) => [
              i.id,
              parseTrack(tracks[i.id], `song.patterns[${n}].tracks.${i.id}`, i.kind),
            ]),
          ),
        }
      }),
      instances,
    ),
    activePattern: int(s.activePattern, "song.activePattern", PATTERN_COUNT),
    chain: list(s.chain, "song.chain")
      .slice(0, MAX_CHAIN)
      .map((c, i) => int(c, `song.chain[${i}]`, PATTERN_COUNT)),
    fx: {
      delayTime: oneOf(fx.delayTime, "song.fx.delayTime", DELAY_TIMES),
      feedback: num(fx.feedback, "song.fx.feedback"),
      reverbDecay: num(fx.reverbDecay, "song.fx.reverbDecay"),
    },
  }
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
  if (s.version === 1) return parseSongV1(s)
  if (s.version !== SONG_VERSION) fail("song.version", `${1} or ${SONG_VERSION}`)
  return parseSongV2(s)
}

export function serializeSong(song: Song): string {
  return JSON.stringify(song, null, 2)
}

/** Kind of a poly track, for callers that only have the kind string. */
export const isPolyKind = (kind: Kind): kind is PolyKind =>
  kind === "poly" || kind === "ep" || kind === "strings"
