/**
 * Reader for song files written before machines became instances (version 1).
 * Old files keep loading: every channel becomes the first instance of its kind.
 */
import { defaultParams, type Instance, type KindParams } from "./instances"
import {
  BASS_PARAMS_DEFAULT,
  BASS_WAVEFORMS,
  DELAY_TIMES,
  EP_PARAMS_DEFAULT,
  PAD_DEFAULT,
  PERC_LEVELS_DEFAULT,
  POLY_PARAMS_DEFAULT,
  STRINGS_PARAMS_DEFAULT,
  WAVEFORMS,
  type BassParams,
  type EpParams,
  type FxParams,
  type PadParams,
  type PolyParams,
  type StringsParams,
  type SynthParams,
} from "./params"
import {
  BASS_NOTES,
  DRUM_VOICES,
  emptyTrack,
  kitRows,
  PAD_IDS,
  PERC_VOICES,
  POLY_KINDS,
  POLY_NOTES,
  polyRow,
  STEP_COUNT,
  SYNTH_NOTES,
  type BassRow,
  type DrumVoiceId,
  type KitRows,
  type PadId,
  type PercVoiceId,
  type Pattern,
  type PolyKind,
  type PolyRow,
  type SynthRow,
  type Track,
} from "./pattern"
import { MAX_CHAIN, PATTERN_COUNT } from "./patterns"
import { SongParseError, type Song } from "./song"

/** The mixer channels a version-1 file could name. */
const V1_CHANNELS = ["drums", "perc", "sampler", "synth", "bass", "poly", "ep", "strings"] as const
type V1Channel = (typeof V1_CHANNELS)[number]

const V1_MIX_LEVEL: Record<V1Channel, number> = {
  drums: 0.9,
  perc: 0.8,
  sampler: 0.85,
  synth: 0.8,
  bass: 0.85,
  poly: 0.7,
  ep: 0.75,
  strings: 0.7,
}
const V1_MIX_SEND: Record<V1Channel, number> = {
  drums: 0.15,
  perc: 0.25,
  sampler: 0.2,
  synth: 0.35,
  bass: 0.15,
  poly: 0.4,
  ep: 0.35,
  strings: 0.3,
}

/** Where a version-1 file keeps each channel's params and its track. */
const V1_PARAM_KEY: Record<V1Channel, string> = {
  drums: "drumLevels",
  perc: "percLevels",
  sampler: "pads",
  synth: "synthParams",
  bass: "bassParams",
  poly: "polyParams",
  ep: "epParams",
  strings: "stringsParams",
}
const V1_TRACK_KEY: Partial<Record<V1Channel, string>> = {
  drums: "drums",
  perc: "perc",
  sampler: "samples",
  synth: "synth",
  bass: "bass",
}

/**
 * The channels a file actually names — in a track, its params or the mix.
 * Only those become instances, so an old DR-4 + MONO-1 song stays a two-unit rack.
 */
function namedChannels(s: Record<string, unknown>, mix: Record<string, unknown>): V1Channel[] {
  const patterns = Array.isArray(s.patterns) ? s.patterns.filter(isRecord) : []
  return V1_CHANNELS.filter((ch) => {
    if (s[V1_PARAM_KEY[ch]] !== undefined) return true
    for (const key of ["level", "send", "mute"]) {
      const m = mix[key]
      if (isRecord(m) && m[ch] !== undefined) return true
    }
    const trackKey = V1_TRACK_KEY[ch]
    return patterns.some((p) =>
      trackKey ? p[trackKey] !== undefined : isRecord(p.poly) && p.poly[ch] !== undefined,
    )
  })
}

interface V1Pattern {
  drums: KitRows
  perc: KitRows
  samples: KitRows
  synth: SynthRow
  bass: BassRow
  poly: Record<PolyKind, PolyRow>
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

function parseKitRows(v: unknown, path: string, ids: readonly string[]): KitRows {
  if (v === undefined) return kitRows(ids)
  const obj = record(v, path)
  const out: Record<string, boolean[]> = {}
  for (const id of ids) out[id] = boolRow(obj[id], `${path}.${id}`)
  return out
}

function parseBassRow(v: unknown, path: string): BassRow {
  if (v === undefined) return (emptyTrack("bass") as { bass: BassRow }).bass
  const obj = record(v, path)
  return {
    notes: monoRow(obj.notes, `${path}.notes`, BASS_NOTES.length),
    accent: boolRow(obj.accent, `${path}.accent`),
    slide: boolRow(obj.slide, `${path}.slide`),
  }
}

function parsePolyRows(v: unknown, path: string): Record<PolyKind, PolyRow> {
  const obj = v === undefined ? {} : record(v, path)
  const out = {} as Record<PolyKind, PolyRow>
  for (const id of POLY_KINDS) {
    out[id] =
      obj[id] === undefined ? polyRow() : chordRow(obj[id], `${path}.${id}`, POLY_NOTES[id].length)
  }
  return out
}

function parsePattern(v: unknown, path: string): V1Pattern {
  const p = record(v, path)
  return {
    drums: parseKitRows(p.drums, `${path}.drums`, DRUM_VOICES),
    perc: parseKitRows(p.perc, `${path}.perc`, PERC_VOICES),
    samples: parseKitRows(p.samples, `${path}.samples`, PAD_IDS),
    synth: monoRow(p.synth, `${path}.synth`, SYNTH_NOTES.length),
    bass: parseBassRow(p.bass, `${path}.bass`),
    poly: parsePolyRows(p.poly, `${path}.poly`),
  }
}

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

function parsePads(v: unknown, path: string): Record<PadId, PadParams> {
  const obj = v === undefined ? {} : record(v, path)
  const out = {} as Record<PadId, PadParams>
  for (const id of PAD_IDS) {
    if (obj[id] === undefined) {
      out[id] = { ...PAD_DEFAULT }
      continue
    }
    const pad = record(obj[id], `${path}.${id}`)
    const name = pad.name ?? null
    out[id] = {
      name:
        name === null || typeof name === "string" ? name : fail(`${path}.${id}.name`, "a string"),
      pitch: num(pad.pitch, `${path}.${id}.pitch`),
      decay: num(pad.decay, `${path}.${id}.decay`),
      level: num(pad.level, `${path}.${id}.level`),
    }
  }
  return out
}

function parseMutes(v: unknown, path: string): Record<V1Channel, boolean> {
  const obj = v === undefined ? {} : record(v, path)
  const out = {} as Record<V1Channel, boolean>
  for (const ch of V1_CHANNELS) {
    const value = obj[ch] ?? false
    out[ch] = typeof value === "boolean" ? value : fail(`${path}.${ch}`, "a boolean")
  }
  return out
}

/** Parse a version-1 file and lift it into the instance-based Song. */
export function parseSongV1(s: Record<string, unknown>): Song {
  const synth = record(s.synthParams, "song.synthParams")
  const mix = record(s.mix, "song.mix")
  const fx = record(s.fx, "song.fx")

  const patterns = list(s.patterns, "song.patterns", PATTERN_COUNT).map((p, i) =>
    parsePattern(p, `song.patterns[${i}]`),
  )
  const level = parseNumbers(mix.level, "song.mix.level", V1_CHANNELS, V1_MIX_LEVEL)
  const send = parseNumbers(mix.send, "song.mix.send", V1_CHANNELS, V1_MIX_SEND)
  const mute = parseMutes(mix.mute, "song.mix.mute")

  const params: KindParams = {
    drums: parseNumbers(s.drumLevels, "song.drumLevels", DRUM_VOICES),
    perc: parseNumbers(s.percLevels, "song.percLevels", PERC_VOICES, PERC_LEVELS_DEFAULT),
    sampler: parsePads(s.pads, "song.pads"),
    synth: {
      waveform: oneOf(synth.waveform, "song.synthParams.waveform", WAVEFORMS),
      cutoff: num(synth.cutoff, "song.synthParams.cutoff"),
      resonance: num(synth.resonance, "song.synthParams.resonance"),
      decay: num(synth.decay, "song.synthParams.decay"),
    } satisfies SynthParams,
    bass: parseParams<BassParams>(s.bassParams, "song.bassParams", BASS_PARAMS_DEFAULT, {
      waveform: BASS_WAVEFORMS,
    }),
    poly: parseParams<PolyParams>(s.polyParams, "song.polyParams", POLY_PARAMS_DEFAULT, {
      waveform: WAVEFORMS,
    }),
    ep: parseParams<EpParams>(s.epParams, "song.epParams", EP_PARAMS_DEFAULT),
    strings: parseParams<StringsParams>(
      s.stringsParams,
      "song.stringsParams",
      STRINGS_PARAMS_DEFAULT,
    ),
  }

  // One instance per named channel, id `${kind}-1`, in the classic order.
  const kinds = namedChannels(s, mix)
  const instances = kinds.map(
    (kind) =>
      ({
        id: `${kind}-1`,
        kind,
        params: params[kind] ?? defaultParams(kind),
        level: level[kind],
        send: send[kind],
        mute: mute[kind],
      }) as Instance,
  )

  const lifted: Pattern[] = patterns.map((p) => {
    const tracks: Record<string, Track> = {
      "drums-1": { kind: "drums", rows: p.drums as KitRows<DrumVoiceId> },
      "perc-1": { kind: "perc", rows: p.perc as KitRows<PercVoiceId> },
      "sampler-1": { kind: "sampler", rows: p.samples as KitRows<PadId> },
      "synth-1": { kind: "synth", notes: p.synth },
      "bass-1": { kind: "bass", bass: p.bass },
      "poly-1": { kind: "poly", chords: p.poly.poly },
      "ep-1": { kind: "ep", chords: p.poly.ep },
      "strings-1": { kind: "strings", chords: p.poly.strings },
    }
    return {
      tracks: Object.fromEntries(kinds.map((kind) => [`${kind}-1`, tracks[`${kind}-1`]!])),
    }
  })

  return {
    version: 2,
    bpm: num(s.bpm, "song.bpm"),
    swing: num(s.swing ?? 0, "song.swing"),
    masterVolume: num(s.masterVolume, "song.masterVolume"),
    instances,
    patterns: lifted,
    activePattern: int(s.activePattern, "song.activePattern", PATTERN_COUNT),
    chain: list(s.chain, "song.chain")
      .slice(0, MAX_CHAIN)
      .map((c, i) => int(c, `song.chain[${i}]`, PATTERN_COUNT)),
    fx: {
      delayTime: oneOf(fx.delayTime, "song.fx.delayTime", DELAY_TIMES),
      feedback: num(fx.feedback, "song.fx.feedback"),
      reverbDecay: num(fx.reverbDecay, "song.fx.reverbDecay"),
    } satisfies FxParams,
  }
}
