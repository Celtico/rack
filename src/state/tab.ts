/**
 * Guitar tablature in text ("e|--0--3--|" × 6), read into notes — pure. A tab
 * site or a forum post is pasted; the lines are the strings (the thin E on
 * top), the digits the frets, and time runs left to right: every column that
 * holds a digit is one step, digits in the same column sound together.
 */

import { keyRows, SCALE_NAMES, type KeyParams, type ScaleName } from "./key"

/** A note as a tab writes it: which string (0 = the low E) and which fret. */
export interface TabNote {
  string: number
  fret: number
}

/** One step of a tab: the notes struck together in that column. */
export type TabColumn = TabNote[]

const STRINGS_PER_SYSTEM = 6
/** A tab line: an optional string name, a bar, then dashes, digits and the odd symbol. */
const TAB_LINE = /^\s*[eEBGDAa]?\s*\|?([-0-9|hp/\\~xbrs^() ]*)\|?\s*$/
const MIDI_OF_STRING = [40, 45, 50, 55, 59, 64] as const

/**
 * Read a tab. Lines are grouped six at a time (a system); systems follow one
 * another in time. Line order within a system is top = thin E, as written.
 */
export function parseTab(text: string): TabColumn[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => /[-]{2,}/.test(l) && TAB_LINE.test(l))
  const columns: TabColumn[] = []
  for (let start = 0; start + STRINGS_PER_SYSTEM <= lines.length; start += STRINGS_PER_SYSTEM) {
    const system = lines.slice(start, start + STRINGS_PER_SYSTEM).map(bodyOf)
    const width = Math.max(...system.map((l) => l.length))
    for (let x = 0; x < width; x++) {
      const column: TabColumn = []
      system.forEach((line, i) => {
        const c = line[x]
        // The first digit of a number counts; the second is read with it and skipped.
        if (c === undefined || !/\d/.test(c) || (x > 0 && /\d/.test(line[x - 1]!))) return
        const two = line[x + 1] !== undefined && /\d/.test(line[x + 1]!) ? line.slice(x, x + 2) : c
        const fret = Number(two)
        if (fret <= 24) column.push({ string: STRINGS_PER_SYSTEM - 1 - i, fret })
      })
      if (column.length > 0) columns.push(column)
    }
  }
  return columns
}

/** The part of a tab line after its string name and first bar. */
function bodyOf(line: string): string {
  const bar = line.indexOf("|")
  return bar >= 0 ? line.slice(bar + 1) : line.replace(/^\s*[eEBGDAa]\s*/, "")
}

/** MIDI number of a tab note, in standard tuning. */
export const tabMidi = (note: TabNote): number => MIDI_OF_STRING[note.string]! + note.fret

/** "F#4" → 66: a row name as a MIDI number. */
export const midiOfName = (name: string): number => {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name)!
  const pitch =
    { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]!]! +
    (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0)
  return (Number(m[3]) + 1) * 12 + pitch
}

/** Keys tried for a tab, in the order ties break: the plain scales first. */
const SCALES_TO_TRY: readonly ScaleName[] = [
  "major",
  "minor",
  ...SCALE_NAMES.filter((s) => s !== "major" && s !== "minor"),
]

export interface TabKeyChoice {
  key: KeyParams
  /** How many of the tab's distinct pitches the key's eight rows hold. */
  covered: number
  /** How many they do not — those notes are left out. */
  dropped: number
}

/**
 * The key whose eight rows hold the most of some pitches (MIDI numbers; every
 * root, scale and octave tried). Ties go to `prefer`'s root and scale (the key
 * the machine already has, so only its octave moves when that is enough), then
 * to a key rooted on the lowest pitch (the bass names the key more often than
 * not), then to the plainer scale, then to the lower root.
 */
export function pickKeyForPitches(
  pitchList: Iterable<number>,
  prefer?: Pick<KeyParams, "root" | "scale">,
): TabKeyChoice {
  const pitches = new Set(pitchList)
  const lowest = pitches.size > 0 ? Math.min(...pitches) % 12 : -1
  let best: TabKeyChoice = {
    key: { root: 0, scale: "major", octave: 3 },
    covered: 0,
    dropped: pitches.size,
  }
  let bestScore = -1
  for (const scale of SCALES_TO_TRY)
    for (let octave = 1; octave <= 5; octave++)
      for (let root = 0; root < 12; root++) {
        const key = { root, scale, octave }
        const rows = new Set(keyRows(key).map(midiOfName))
        let covered = 0
        for (const p of pitches) if (rows.has(p)) covered++
        const score =
          covered * 4 +
          (prefer && prefer.root === root && prefer.scale === scale ? 2 : 0) +
          (root === lowest ? 1 : 0)
        if (score > bestScore) {
          bestScore = score
          best = { key, covered, dropped: pitches.size - covered }
        }
      }
  return best
}

/** The key for a tab: the one holding the most of its notes (see `pickKeyForPitches`). */
export const pickKeyFor = (columns: readonly TabColumn[]): TabKeyChoice =>
  pickKeyForPitches(columns.flat().map(tabMidi))

export const STEPS_PER_PATTERN = 16

/**
 * The tab as poly-grid patterns for a key: one step per column, the rows of
 * its notes (those the key has), sixteen steps a pattern, as many patterns as
 * the tab is long. Empty columns never occur (a column is a struck one).
 */
export function tabToPatterns(columns: readonly TabColumn[], key: KeyParams): number[][][] {
  const rowOf = new Map(keyRows(key).map((name, row) => [midiOfName(name), row]))
  const steps = columns.map((column) =>
    [
      ...new Set(
        column.map((n) => rowOf.get(tabMidi(n))).filter((r): r is number => r !== undefined),
      ),
    ].sort((a, b) => a - b),
  )
  const patterns: number[][][] = []
  for (let i = 0; i < steps.length; i += STEPS_PER_PATTERN) {
    const chunk = steps.slice(i, i + STEPS_PER_PATTERN)
    while (chunk.length < STEPS_PER_PATTERN) chunk.push([])
    patterns.push(chunk)
  }
  return patterns
}
