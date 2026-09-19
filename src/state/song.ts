import { clampInstanceKey, defaultParams, hasStripFilter, type Instance } from "./instances"
import {
  defaultMod,
  LFO_SHAPES,
  MACRO_COUNT,
  MOD_TARGETS,
  type LfoParams,
  type Macro,
  type ModParams,
} from "./mod"
import {
  BASS_WAVEFORMS,
  clamp,
  DELAY_TIMES,
  FILTER_DEFAULT,
  FILTER_TYPES,
  FX_DEFAULT,
  SPACE_DEFAULT,
  WAVEFORMS,
  type FilterParams,
  type FxParams,
  type SpaceParams,
} from "./params"
import {
  BASS_NOTES,
  emptyTrack,
  isPatternEmpty,
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
  type PolyRow,
  type SynthRow,
  type Track,
} from "./pattern"
import { MAX_CHAIN, padBank, PATTERN_COUNT } from "./patterns"
import { fitSections, type Section } from "./sections"
import { bool, fail, int, list, num, oneOf, record, SongParseError, str } from "./parse"
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
  /** Named runs of bars over the chain (Intro 8, Verse 16…), covering it exactly; empty for none. */
  sections: Section[]
  fx: FxParams
}

export { SongParseError }

/** Between one and PATTERN_COUNT patterns; shorter banks are padded by the caller. */
export const bank = (v: unknown): unknown[] => {
  const items = list(v, "song.patterns")
  if (items.length < 1 || items.length > PATTERN_COUNT)
    fail("song.patterns", `1 to ${PATTERN_COUNT} items`)
  return items
}

const boolRow = (v: unknown, path: string): boolean[] =>
  list(v, path, STEP_COUNT).map((on, i) => bool(on, `${path}[${i}]`))

/**
 * A row index, pulled into range: files written by hand (or by a chatbot) often
 * count past the eight rows an instrument has; the nearest real row keeps the
 * rhythm rather than dropping the note.
 */
const rowIndex = (v: unknown, path: string, rows: number): number =>
  Number.isInteger(v) ? clamp(v as number, 0, rows - 1) : fail(path, "an integer")

const monoRow = (v: unknown, path: string, rows: number): SynthRow =>
  list(v, path, STEP_COUNT).map((r, i) => (r === null ? null : rowIndex(r, `${path}[${i}]`, rows)))

const chordRow = (v: unknown, path: string, rows: number): PolyRow =>
  list(v, path, STEP_COUNT).map((column, i) =>
    [
      ...new Set(
        list(column, `${path}[${i}]`).map((r, j) => rowIndex(r, `${path}[${i}][${j}]`, rows)),
      ),
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

/** Names a hand-written file is likely to use for a kind of machine, mapped to the real one. */
const KIND_ALIASES: Readonly<Record<string, Kind>> = {
  pad: "poly",
  pads: "poly",
  polysynth: "poly",
  chords: "poly",
  piano: "ep",
  epiano: "ep",
  keys: "ep",
  rhodes: "ep",
  guitar: "strings",
  pluck: "strings",
  string: "strings",
  drum: "drums",
  kit: "drums",
  drumkit: "drums",
  percussion: "perc",
  percs: "perc",
  sample: "sampler",
  samples: "sampler",
  lead: "synth",
  mono: "synth",
  clip: "video",
  movie: "video",
  film: "video",
  loop: "video",
  microphone: "mic",
  voice: "mic",
  vocal: "mic",
  vocals: "mic",
  looper: "mic",
  monosynth: "synth",
  acid: "bass",
  sub: "bass",
}

/** A track of a known kind. A missing track (instance added after the file was saved) is silent. */
function parseTrack(v: unknown, path: string, kind: Kind): Track {
  if (v === undefined) return emptyTrack(kind)
  const t = record(v, path)
  const named = typeof t.kind === "string" ? (KIND_ALIASES[t.kind.toLowerCase()] ?? t.kind) : t.kind
  if (named !== kind) fail(`${path}.kind`, kind)
  switch (kind) {
    case "drums":
    case "perc":
    case "sampler":
    case "video":
    case "mic":
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
    } else if (key === "filterType") {
      // Older files have no filter type: they keep the lowpass they were made with.
      out[key] = oneOf(value, `${path}.${key}`, FILTER_TYPES)
    } else if (key === "videoName" || key === "loopName" || key === "loopKey") {
      out[key] = value === null ? null : str(value, `${path}.${key}`)
    } else if (key === "live") {
      out[key] = bool(value, `${path}.${key}`)
    } else {
      out[key] = num(value, `${path}.${key}`)
    }
  }
  return out as Instance["params"]
}

/** The strip filter of a kind that has one; a file from before them, or a partial one, is wide open. */
function parseFilter(v: unknown, path: string): FilterParams {
  const obj = v === undefined ? {} : record(v, path)
  return {
    type: oneOf(obj.type ?? FILTER_DEFAULT.type, `${path}.type`, FILTER_TYPES),
    cutoff: num(obj.cutoff ?? FILTER_DEFAULT.cutoff, `${path}.cutoff`),
    resonance: num(obj.resonance ?? FILTER_DEFAULT.resonance, `${path}.resonance`),
  }
}

/** Every field of the modulation block, each falling back to its default when the file lacks it. */
function parseMod(v: unknown, path: string): ModParams {
  const d = defaultMod()
  if (v === undefined) return d
  const obj = record(v, path)
  const lfo = (i: 0 | 1): LfoParams => {
    const raw = Array.isArray(obj.lfo) ? obj.lfo[i] : undefined
    const l = raw === undefined ? {} : record(raw, `${path}.lfo[${i}]`)
    const base = d.lfo[i]
    return {
      shape: oneOf(l.shape ?? base.shape, `${path}.lfo[${i}].shape`, LFO_SHAPES),
      rate: num(l.rate ?? base.rate, `${path}.lfo[${i}].rate`),
      target: oneOf(l.target ?? base.target, `${path}.lfo[${i}].target`, MOD_TARGETS),
      amount: num(l.amount ?? base.amount, `${path}.lfo[${i}].amount`),
    }
  }
  const macro = (i: number): Macro => {
    const raw = Array.isArray(obj.macros) ? obj.macros[i] : undefined
    const m = raw === undefined ? {} : record(raw, `${path}.macros[${i}]`)
    const targets = m.targets === undefined ? [] : list(m.targets, `${path}.macros[${i}].targets`)
    return {
      value: num(m.value ?? 0, `${path}.macros[${i}].value`),
      targets: targets.map((t, n) => {
        const p = `${path}.macros[${i}].targets[${n}]`
        const o = record(t, p)
        return {
          key: str(o.key, `${p}.key`),
          min: num(o.min, `${p}.min`),
          max: num(o.max, `${p}.max`),
        }
      }),
    }
  }
  const random = obj.random === undefined ? {} : record(obj.random, `${path}.random`)
  return {
    tune: num(obj.tune ?? d.tune, `${path}.tune`),
    drive: num(obj.drive ?? d.drive, `${path}.drive`),
    lfo: [lfo(0), lfo(1)],
    random: {
      target: oneOf(random.target ?? d.random.target, `${path}.random.target`, MOD_TARGETS),
      amount: num(random.amount ?? d.random.amount, `${path}.random.amount`),
    },
    macros: Array.from({ length: MACRO_COUNT }, (_, i) => macro(i)) as ModParams["macros"],
  }
}

function parseInstance(v: unknown, path: string): Instance {
  const obj = record(v, path)
  const alias = typeof obj.kind === "string" ? KIND_ALIASES[obj.kind.toLowerCase()] : undefined
  const kind = alias ?? oneOf(obj.kind, `${path}.kind`, KINDS)
  // A key is optional and lenient: out of range is pulled in, a nonsense one is no key (the fixed rows).
  const key = clampInstanceKey(kind, obj.key)
  return {
    id: str(obj.id, `${path}.id`),
    kind,
    params: parseParams(obj.params, `${path}.params`, kind),
    level: num(obj.level, `${path}.level`),
    send: num(obj.send, `${path}.send`),
    mute: bool(obj.mute ?? false, `${path}.mute`),
    // Older files sit in the middle, at the default distance.
    pan: num(obj.pan ?? 0, `${path}.pan`),
    space: parseSpace(obj.space, `${path}.space`),
    ...(hasStripFilter(kind) ? { filter: parseFilter(obj.filter, `${path}.filter`) } : {}),
    mod: parseMod(obj.mod, `${path}.mod`),
    ...(key ? { key } : {}),
  } as Instance
}

function parseSpace(v: unknown, path: string): SpaceParams {
  const obj = v === undefined ? {} : record(v, path)
  return {
    angle: num(obj.angle ?? SPACE_DEFAULT.angle, `${path}.angle`),
    distance: num(obj.distance ?? SPACE_DEFAULT.distance, `${path}.distance`),
  }
}

function parseSongV2(s: Record<string, unknown>): Song {
  const instances = list(s.instances, "song.instances").map((i, n) =>
    parseInstance(i, `song.instances[${n}]`),
  )
  const ids = new Set(instances.map((i) => i.id))
  if (ids.size !== instances.length) fail("song.instances", "unique ids")
  // Missing effects, chain or active slot are what a hand-written file most often lacks: defaults.
  const fx = s.fx === undefined ? {} : record(s.fx, "song.fx")
  const patterns = padBank(
    bank(s.patterns).map((p, n) => {
      const slot = record(p, `song.patterns[${n}]`)
      const tracks = record(slot.tracks, `song.patterns[${n}].tracks`)
      // Parts sitting this slot out: only ids the song knows; a missing list means everyone plays.
      const muted =
        slot.muted === undefined
          ? []
          : list(slot.muted, `song.patterns[${n}].muted`)
              .map((m, i) => str(m, `song.patterns[${n}].muted[${i}]`))
              .filter((m) => ids.has(m))
      return {
        tracks: Object.fromEntries(
          instances.map((i) => [
            i.id,
            parseTrack(tracks[i.id], `song.patterns[${n}].tracks.${i.id}`, i.kind),
          ]),
        ),
        ...(muted.length ? { muted } : {}),
      }
    }),
    instances,
  )
  // No chain in the file: play every slot that has something in it, in order — what the
  // author of a file without one almost always means.
  const filled = patterns.flatMap((p, i) => (isPatternEmpty(p) ? [] : [i]))
  const chain =
    s.chain === undefined
      ? filled.slice(0, MAX_CHAIN)
      : list(s.chain, "song.chain")
          .slice(0, MAX_CHAIN)
          .map((c, i) => int(c, `song.chain[${i}]`, PATTERN_COUNT))
  // Sections are optional and fitted to the chain: a hand-written file may count them loosely.
  const sections =
    s.sections === undefined
      ? []
      : fitSections(
          list(s.sections, "song.sections").map((v, i) => {
            const section = record(v, `song.sections[${i}]`)
            return {
              name: typeof section.name === "string" ? section.name : "",
              bars: num(section.bars, `song.sections[${i}].bars`),
            }
          }),
          chain.length,
        )

  return {
    version: SONG_VERSION,
    bpm: num(s.bpm, "song.bpm"),
    swing: num(s.swing ?? 0, "song.swing"),
    masterVolume: num(s.masterVolume, "song.masterVolume"),
    instances,
    patterns,
    activePattern: int(s.activePattern ?? filled[0] ?? 0, "song.activePattern", PATTERN_COUNT),
    chain,
    sections,
    fx: {
      delayTime: oneOf(fx.delayTime ?? FX_DEFAULT.delayTime, "song.fx.delayTime", DELAY_TIMES),
      feedback: num(fx.feedback ?? FX_DEFAULT.feedback, "song.fx.feedback"),
      reverbDecay: num(fx.reverbDecay ?? FX_DEFAULT.reverbDecay, "song.fx.reverbDecay"),
      pingPong: bool(fx.pingPong ?? false, "song.fx.pingPong"),
      space: bool(fx.space ?? false, "song.fx.space"),
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
