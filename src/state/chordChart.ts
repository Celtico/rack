/**
 * A chord chart (the text of a Cifra Club / Ultimate Guitar page: section
 * names, lines of chord names, lyrics under them) turned into a rack song —
 * and, first, into the table of equivalences the user reads it by: every
 * chord as the notes it holds and the grid rows of the key that carry them.
 * Pure: no store, no audio.
 */
import { createInstance, type Instance } from "./instances"
import {
  keyRows,
  pitchName,
  rowPitchClasses,
  solfege,
  spelledWithSharps,
  type KeyParams,
} from "./key"
import { BPM_MAX, BPM_MIN, clamp, FX_DEFAULT } from "./params"
import { emptyTrack, STEP_COUNT, type Kind, type Pattern, type Track } from "./pattern"
import { MAX_CHAIN, padBank, PATTERN_COUNT } from "./patterns"
import { fitSections, type Section } from "./sections"
import { SONG_VERSION, type Song } from "./song"

export class ChordChartError extends Error {
  override name = "ChordChartError"
}

// ---------- chord names ----------

/** A chord as pitch classes: its root, the intervals over it, and the bass under it if written. */
export interface Chord {
  name: string
  root: number
  /** Semitones above the root, root included (0). */
  intervals: number[]
  /** A slash bass ("D/F#"), as a pitch class. */
  bass?: number
}

const PITCH_CLASS: Readonly<Record<string, number>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  "B#": 0,
}

const NOTE = /^([A-G])([#b]?)/

/** Quality tokens, longest first so "maj7" is not read as "m" + "aj7". */
const QUALITY_TOKENS = [
  "maj13",
  "maj11",
  "maj9",
  "maj7",
  "M7",
  "7M",
  "7+",
  "m7(b5)",
  "m7b5",
  "ø7",
  "ø",
  "dim7",
  "°7",
  "º7",
  "dim",
  "°",
  "º",
  "aug",
  "+",
  "min",
  "m",
  "sus4",
  "sus2",
  "sus",
  "add13",
  "add11",
  "add9",
  "add2",
  "add4",
  "6/9",
  "13",
  "11",
  "9",
  "7",
  "6",
  "5",
  "4",
  "2",
] as const

/** Alterations inside parentheses: "(9)", "(b5)", "(#11)", "(add9)", "(4)"… */
const ALTERATIONS: Readonly<Record<string, (c: Build) => void>> = {
  "9": (c) => c.add.add(14),
  b9: (c) => c.add.add(13),
  "#9": (c) => c.add.add(15),
  "11": (c) => c.add.add(17),
  "#11": (c) => c.add.add(18),
  "13": (c) => c.add.add(21),
  b13: (c) => c.add.add(20),
  b5: (c) => (c.fifth = 6),
  "#5": (c) => (c.fifth = 8),
  "5-": (c) => (c.fifth = 6),
  "5+": (c) => (c.fifth = 8),
  "4": (c) => (c.third = 5),
  "2": (c) => (c.third = 2),
  add9: (c) => c.add.add(14),
  add11: (c) => c.add.add(17),
  "6": (c) => c.add.add(9),
  "7": (c) => c.add.add(10),
  "7M": (c) => c.add.add(11),
  "7+": (c) => c.add.add(11),
}

interface Build {
  third: number | null
  fifth: number
  add: Set<number>
}

const apply = (c: Build, token: string): boolean => {
  switch (token) {
    case "maj7":
    case "M7":
    case "7M":
    case "7+":
      c.add.add(11)
      return true
    case "maj9":
      c.add.add(11)
      c.add.add(14)
      return true
    case "maj11":
      c.add.add(11)
      c.add.add(14)
      c.add.add(17)
      return true
    case "maj13":
      c.add.add(11)
      c.add.add(14)
      c.add.add(21)
      return true
    case "m7(b5)":
    case "m7b5":
    case "ø7":
    case "ø":
      c.third = 3
      c.fifth = 6
      c.add.add(10)
      return true
    case "dim7":
    case "°7":
    case "º7":
      c.third = 3
      c.fifth = 6
      c.add.add(9)
      return true
    case "dim":
    case "°":
    case "º":
      c.third = 3
      c.fifth = 6
      return true
    case "aug":
    case "+":
      c.fifth = 8
      return true
    case "min":
    case "m":
      c.third = 3
      return true
    case "sus4":
    case "sus":
    case "4":
      c.third = 5
      return true
    case "sus2":
    case "2":
      c.third = 2
      return true
    case "add2":
      c.add.add(2)
      return true
    case "add4":
      c.add.add(5)
      return true
    case "add9":
      c.add.add(14)
      return true
    case "add11":
      c.add.add(17)
      return true
    case "add13":
      c.add.add(21)
      return true
    case "6/9":
      c.add.add(9)
      c.add.add(14)
      return true
    case "6":
      c.add.add(9)
      return true
    case "7":
      c.add.add(10)
      return true
    case "9":
      c.add.add(10)
      c.add.add(14)
      return true
    case "11":
      c.add.add(10)
      c.add.add(14)
      c.add.add(17)
      return true
    case "13":
      c.add.add(10)
      c.add.add(14)
      c.add.add(21)
      return true
    case "5":
      c.third = null
      return true
  }
  return false
}

/**
 * "Em7", "D7+", "A4", "F#m7(b5)", "G/B" → the chord's pitch classes, or null
 * for a token that is not a chord name (a lyric, a tab line).
 */
export function parseChord(raw: string): Chord | null {
  const name = raw.trim()
  const m = NOTE.exec(name)
  if (!m) return null
  const root = PITCH_CLASS[`${m[1]}${m[2]}`]
  if (root === undefined) return null
  let rest = name.slice(m[0].length)
  let bass: number | undefined
  const slash = /\/([A-G][#b]?)$/.exec(rest)
  if (slash) {
    bass = PITCH_CLASS[slash[1]!]
    if (bass === undefined) return null
    rest = rest.slice(0, slash.index)
  }
  const build: Build = { third: 4, fifth: 7, add: new Set() }
  while (rest.length) {
    if (rest.startsWith("(")) {
      const end = rest.indexOf(")")
      if (end < 0) return null
      for (const alt of rest
        .slice(1, end)
        .split(/[,\s]+/)
        .filter(Boolean)) {
        const fn = ALTERATIONS[alt]
        if (!fn) return null
        fn(build)
      }
      rest = rest.slice(end + 1)
      continue
    }
    const token = QUALITY_TOKENS.find((t) => rest.startsWith(t))
    if (!token || !apply(build, token)) return null
    rest = rest.slice(token.length)
  }
  const intervals = [0, ...(build.third === null ? [] : [build.third]), build.fifth, ...build.add]
  return {
    name,
    root,
    intervals: [...new Set(intervals.map((i) => i % 24))].sort((a, b) => a - b),
    bass,
  }
}

// ---------- the chart ----------

export interface ChartSection {
  name: string
  /** The chord names in order, one per beat-group as written (a bar each by default). */
  chords: string[]
}

export interface Chart {
  sections: ChartSection[]
  /**
   * The key the chords are written in, when the page says so: "Tom: Eb" with a capo on fret 1 means
   * D shapes played a semitone up, so the root is the tone less the capo (2, D).
   */
  root?: number
  /** "Tom: Em" → minor. */
  scale?: "major" | "minor"
  /** "Capotraste na 1ª casa" → 1. */
  capo?: number
}

const SECTION_WORDS =
  /^\s*\[?\s*(intro(?:du[cç][aã]o)?|verse|estrofa|estrofe|vers|chorus|refr[aã]o|refrain|coro|tornada|pre-?\s?(?:chorus|coro|refr[aã]o)|bridge|ponte|pont|solo|outro|final|ending|coda|interlude|interl[uú]dio|instrumental|riff|parte?\s*\w*|part\s*\w*|primeira parte|segunda parte|terceira parte|break|hook|tab)\s*(\d+)?\s*\]?\s*:?\s*(.*)$/i

const REPEAT = /(?:\(?\s*(\d+)\s*[x×]\s*\)?|\(?\s*[x×]\s*(\d+)\s*\)?)\s*$/i

/** A line that is chords (and separators) and nothing else. */
function chordTokens(line: string): string[] | null {
  const tokens = line
    .replace(REPEAT, "")
    .split(/[\s|]+/)
    .filter((t) => t && t !== "-" && t !== "–" && t !== "—" && t !== "%" && t !== "/")
  if (!tokens.length || !parseChord(tokens[0]!)) return null
  // A line of chords may carry a name the rack does not know (flagged in the table); a lyric line
  // that happens to open with "A" or "Em" does not read as chords past its first word.
  const known = tokens.filter((t) => parseChord(t)).length
  if (known < tokens.length && (known * 5 < tokens.length * 3 || tokens.length > 8)) return null
  return tokens
}

const repeatsOf = (line: string): number => {
  const m = REPEAT.exec(line)
  const n = Number(m?.[1] ?? m?.[2] ?? 1)
  return Number.isFinite(n) && n > 1 ? Math.min(n, 16) : 1
}

/**
 * The chart's sections and chord lines out of a page's text. Section names
 * ("[Intro]", "Refrão:", "Verse 2") start a section; a line made only of chord
 * names adds them (a trailing "2x" repeats the line); anything else — lyrics,
 * tablature — is skipped. "Tom:" and "Capotraste" lines are read for the key
 * and the capo.
 */
export function parseChart(text: string): Chart {
  const sections: ChartSection[] = []
  let current: ChartSection | null = null
  const chart: Chart = { sections }
  const push = (chords: string[]) => {
    if (!current) {
      current = { name: "Part 1", chords: [] }
      sections.push(current)
    }
    current.chords.push(...chords)
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, " ").trim()
    if (!line) continue
    const tom = /^(?:tom|key|tonalitat|tono)\s*:\s*([A-G][#b]?)(m(?![a-z]))?/i.exec(line)
    if (tom) {
      chart.root = PITCH_CLASS[tom[1]!]
      chart.scale = tom[2] ? "minor" : "major"
      continue
    }
    const capo = /capo\w*[^0-9]*(\d+)/i.exec(line)
    if (capo) {
      chart.capo = Number(capo[1])
      continue
    }
    // Tablature: "e|---3---" — never chords.
    if (/^[eBGDAE]\|/.test(line) || /-{3,}/.test(line)) continue
    const bracket = /^\[([^\]]+)\]\s*:?\s*(.*)$/.exec(line)
    const header = bracket
      ? ([line, bracket[1]!, undefined, bracket[2]] as unknown as RegExpExecArray)
      : SECTION_WORDS.exec(line)
    if (header && !parseChord(line.split(/[\s|]+/)[0]!)) {
      const word = header[1]!.trim().replace(/\s+/g, " ")
      const name =
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase() +
        (header[2] ? ` ${header[2]}` : "")
      current = { name, chords: [] }
      sections.push(current)
      const inline = header[3]?.trim()
      if (inline) {
        const chords = chordTokens(inline)
        if (chords) for (let i = 0; i < repeatsOf(inline); i++) push(chords)
      }
      continue
    }
    const chords = chordTokens(line)
    if (chords) for (let i = 0; i < repeatsOf(line); i++) push(chords)
  }
  chart.sections = sections.filter((s) => s.chords.length > 0)
  if (chart.root !== undefined && chart.capo) chart.root = (chart.root - chart.capo + 120) % 12
  return chart
}

// ---------- equivalences ----------

/** One line of the table: a chord, the notes it holds, and the rows of the key that carry them. */
export interface Equivalence {
  chord: string
  /** Every note of the chord, letter name. */
  notes: string[]
  /** The rows (0–7) lit for it on a chord grid, low to high. */
  rows: number[]
  /** The row the bass plays, or null when the key has no row for the bass note. */
  bassRow: number | null
  /** Notes of the chord the key's rows cannot carry — left out. */
  dropped: string[]
  /** Not a chord name the rack understands. */
  unknown?: boolean
}

/** A chord written with a flat or a sharp keeps that spelling; a natural one takes the key's. */
const chordSharps = (chord: Chord, key: KeyParams): boolean =>
  /^[A-G]#/.test(chord.name) ? true : /^[A-G]b/.test(chord.name) ? false : spelledWithSharps(key)

/**
 * The rows of a key that carry a chord: each chord tone on the lowest row of
 * its pitch class at or above the root's row (the octave rows wrap round), so
 * the voicing stacks upward from the root as a hand would play it.
 */
export function chordRows(
  chord: Chord,
  key: KeyParams,
): { rows: number[]; bassRow: number | null; dropped: string[] } {
  const pcs = rowPitchClasses(key)
  const pcName = (pc: number) => pitchName(pc, chordSharps(chord, key))
  const rowsOf = (pc: number) => pcs.flatMap((p, i) => (p === pc ? [i] : []))
  const rootRows = rowsOf(chord.root)
  const base = rootRows[0] ?? 0
  const rows = new Set<number>()
  const dropped: string[] = []
  for (const interval of chord.intervals) {
    const pc = (chord.root + interval) % 12
    const candidates = rowsOf(pc)
    if (!candidates.length) {
      dropped.push(pcName(pc))
      continue
    }
    rows.add(candidates.find((r) => r >= base) ?? candidates[0]!)
  }
  const bassPc = chord.bass ?? chord.root
  const bassRow = rowsOf(bassPc)[0] ?? null
  if (chord.bass !== undefined && bassRow === null) dropped.push(pcName(chord.bass))
  return { rows: [...rows].sort((a, b) => a - b), bassRow, dropped: [...new Set(dropped)] }
}

/** The table for every distinct chord of a chart in a key, in order of first appearance. */
export function equivalences(chart: Chart, key: KeyParams): Equivalence[] {
  const seen = new Set<string>()
  const out: Equivalence[] = []
  for (const section of chart.sections)
    for (const name of section.chords) {
      if (seen.has(name)) continue
      seen.add(name)
      const chord = parseChord(name)
      if (!chord) {
        out.push({ chord: name, notes: [], rows: [], bassRow: null, dropped: [], unknown: true })
        continue
      }
      const { rows, bassRow, dropped } = chordRows(chord, key)
      out.push({
        chord: name,
        notes: chord.intervals.map((i) => pitchName(chord.root + i, chordSharps(chord, key))),
        rows,
        bassRow,
        dropped,
      })
    }
  return out
}

/** "Re3 · D3" — a row label with both spellings, for the table. */
export const rowName = (key: KeyParams, row: number): string => {
  const note = keyRows(key)[row] ?? ""
  return `${solfege(note)} · ${note}`
}

// ---------- the song ----------

export const STRUMS = ["once", "quarters", "eighths", "folk"] as const
export type Strum = (typeof STRUMS)[number]
export const STRUM_LABELS: Readonly<Record<Strum, string>> = {
  once: "Once a chord",
  quarters: "Quarter notes",
  eighths: "Eighth notes",
  folk: "Folk strum",
}

export const BEATS = ["none", "rock", "pop", "shuffle"] as const
export type Beat = (typeof BEATS)[number]
export const BEAT_LABELS: Readonly<Record<Beat, string>> = {
  none: "No drums",
  rock: "Rock",
  pop: "Pop",
  shuffle: "Half-time",
}

export interface ChartOptions {
  key: KeyParams
  /** Fret of the capo: every melodic machine is tuned up by it. */
  capo: number
  bpm: number
  /** Chords per bar as written: 1 (a chord a bar) or 2 (two a bar). */
  chordsPerBar: 1 | 2
  strum: Strum
  beat: Beat
  /** Which machines get a part. */
  parts: { bass: boolean; guitar: boolean; piano: boolean; pad: boolean }
}

export const CHART_DEFAULTS: ChartOptions = {
  key: { root: 0, scale: "major", octave: 3 },
  capo: 0,
  bpm: 120,
  chordsPerBar: 1,
  strum: "folk",
  beat: "rock",
  parts: { bass: true, guitar: true, piano: false, pad: false },
}

const STRUM_STEPS: Readonly<Record<Strum, (span: number) => number[]>> = {
  once: () => [0],
  quarters: (span) => range(span, 4),
  eighths: (span) => range(span, 2),
  // D . D U . U D U over a bar, halved for a half-bar chord.
  folk: (span) => (span >= 16 ? [0, 4, 6, 10, 12, 14] : [0, 2, 3, 5, 6, 7]),
}
const range = (span: number, every: number) =>
  Array.from({ length: Math.ceil(span / every) }, (_, i) => i * every)

const BEAT_ROWS: Readonly<Record<Beat, Record<string, string>>> = {
  none: {},
  rock: { kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
  pop: { kick: "x.....x...x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
  shuffle: { kick: "x.........x.....", snare: "........x.......", hat: "x..x..x.x..x..x." },
}

const hits = (s: string) =>
  [...s.padEnd(STEP_COUNT, ".").slice(0, STEP_COUNT)].map((c) => c === "x")

const setRows = (track: Track, rows: Record<string, string>): Track => {
  const kit = track as unknown as { rows: Record<string, boolean[]> }
  return {
    ...track,
    rows: {
      ...kit.rows,
      ...Object.fromEntries(Object.entries(rows).map(([v, r]) => [v, hits(r)])),
    },
  } as unknown as Track
}

/** A song from a chart: one pattern per distinct bar of chords, the chain and sections as written. */
export function chartToSong(
  chart: Chart,
  options: ChartOptions,
): { song: Song; equivalences: Equivalence[] } {
  if (!chart.sections.length) throw new ChordChartError("no chord lines were found")
  const table = equivalences(chart, options.key)
  const byName = new Map(table.map((e) => [e.chord, e]))
  const unknown = table.filter((e) => e.unknown).map((e) => e.chord)
  if (unknown.length) throw new ChordChartError(`not chords the rack knows: ${unknown.join(", ")}`)

  const instances: Instance[] = []
  const add = (kind: Kind, octave: number, level: number, send: number, pan = 0): Instance => {
    const inst = createInstance(kind, instances)
    const melodic = kind !== "drums"
    const built = {
      ...inst,
      level,
      send,
      pan,
      ...(melodic ? { key: { ...options.key, octave } } : {}),
      mod: { ...inst.mod, tune: melodic ? clamp(options.capo, -12, 12) : 0 },
    } as Instance
    instances.push(built)
    return built
  }
  const drums = options.beat !== "none" ? add("drums", 0, 0.85, 0.1) : null
  const bass = options.parts.bass ? add("bass", 1, 0.8, 0.05) : null
  // A dry guitar where a real one sits (the low E is E2): a reverb on every strum of an eighth-note
  // pattern is a wash.
  const guitar = options.parts.guitar ? add("strings", 2, 0.55, 0.12, -0.2) : null
  const piano = options.parts.piano ? add("ep", 3, 0.55, 0.35, 0.2) : null
  const pad = options.parts.pad ? add("poly", 3, 0.35, 0.6) : null
  if (!instances.length) throw new ChordChartError("pick at least one machine")
  // Copies: a kind's default params object is shared, never written to.
  if (bass)
    bass.params = {
      ...bass.params,
      cutoff: 260,
      resonance: 2,
      envMod: 0.3,
      decay: 0.4,
      sustain: 0.5,
    }
  if (pad)
    pad.params = {
      ...pad.params,
      waveform: "triangle",
      cutoff: 1400,
      attack: 0.6,
      release: 2.5,
      sustain: 0.85,
    }

  // Bars: the chords, `chordsPerBar` to a bar, section by section.
  const perBar = options.chordsPerBar
  const span = STEP_COUNT / perBar
  const bars: { chords: string[]; section: number }[] = []
  chart.sections.forEach((section, index) => {
    for (let i = 0; i < section.chords.length; i += perBar)
      bars.push({ chords: section.chords.slice(i, i + perBar), section: index })
  })
  if (bars.length > MAX_CHAIN) bars.length = MAX_CHAIN

  const barTracks = (chords: string[]): Record<string, Track> => {
    const tracks: Record<string, Track> = {}
    for (const inst of instances) tracks[inst.id] = structuredClone(emptyTrack(inst.kind))
    if (drums) tracks[drums.id] = setRows(tracks[drums.id]!, BEAT_ROWS[options.beat])
    chords.forEach((name, n) => {
      const eq = byName.get(name)!
      const at = n * span
      const chordAt = (id: string, steps: number[]) => {
        const t = tracks[id] as unknown as { chords: number[][] }
        for (const s of steps) if (at + s < STEP_COUNT) t.chords[at + s] = [...eq.rows]
      }
      if (guitar) chordAt(guitar.id, STRUM_STEPS[options.strum](span))
      if (piano) chordAt(piano.id, span >= 16 ? [0, 8] : [0])
      if (pad) chordAt(pad.id, [0])
      if (bass && eq.bassRow !== null) {
        const b = (
          tracks[bass.id] as unknown as { bass: { notes: (number | null)[]; accent: boolean[] } }
        ).bass
        for (const s of range(span, 4)) {
          b.notes[at + s] = eq.bassRow
          if (s === 0) b.accent[at] = true
        }
      }
    })
    return tracks
  }

  // One pattern per distinct bar, the chain replays them; sections follow the chart's.
  const slots = new Map<string, number>()
  const patterns: Pattern[] = []
  const chain: number[] = []
  const sectionBars = chart.sections.map(() => 0)
  for (const bar of bars) {
    const tracks = barTracks(bar.chords)
    const k = JSON.stringify(tracks)
    let slot = slots.get(k)
    if (slot === undefined) {
      if (patterns.length >= PATTERN_COUNT)
        throw new ChordChartError(
          `more than ${PATTERN_COUNT} different bars — the bank holds ${PATTERN_COUNT}`,
        )
      slot = patterns.length
      slots.set(k, slot)
      patterns.push({ tracks })
    }
    chain.push(slot)
    sectionBars[bar.section]!++
  }
  const sections: Section[] = fitSections(
    chart.sections.map((s, i) => ({ name: s.name, bars: sectionBars[i]! })),
    chain.length,
  )

  const song: Song = {
    version: SONG_VERSION,
    bpm: Math.round(clamp(options.bpm, BPM_MIN, BPM_MAX)),
    swing: 0,
    masterVolume: 0.8,
    instances,
    patterns: padBank(patterns, instances),
    activePattern: 0,
    chain: chain.length > 1 ? chain : [],
    sections: chain.length > 1 ? sections : [],
    fx: { ...FX_DEFAULT },
  }
  return { song, equivalences: table }
}
