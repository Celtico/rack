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

const STRINGS_PER_SYSTEM = 6
export const STEPS_PER_PATTERN = 16
/** A tab line: an optional string name, a bar, then dashes, digits and the odd symbol. */
const TAB_LINE = /^\s*[eEBGDAa]?\s*\|?([-0-9|hp/\\~xbrs^() ]*)\|?\s*$/
const MIDI_OF_STRING = [40, 45, 50, 55, 59, 64] as const

/** One step of a tab: the notes struck together in that column, and when. */
export interface TabColumn extends Array<TabNote> {
  /** The sixteenth the column falls on, counted from the tab's first note across bars and systems. */
  step: number
}

const column = (notes: TabNote[], step: number): TabColumn => Object.assign(notes, { step })

/**
 * Read a tab. Lines are grouped six at a time (a system); systems follow one
 * another in time. Line order within a system is top = thin E, as written.
 *
 * Time: a tab's bar lines (`|` inside the body) split it into bars, and a
 * bar's characters are spread over sixteen steps, so "|-2---1---|" is
 * two notes an eighth apart, not two sixteenths. When that would land two
 * struck columns on the same step — a tab written wider than a bar, with no
 * inner bar lines — the columns go one step each instead, as they read.
 */
export function parseTab(text: string): TabColumn[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => /[-]{2,}/.test(l) && TAB_LINE.test(l))
  const columns: TabColumn[] = []
  let base = 0
  for (let start = 0; start + STRINGS_PER_SYSTEM <= lines.length; start += STRINGS_PER_SYSTEM) {
    const system = lines.slice(start, start + STRINGS_PER_SYSTEM).map(bodyOf)
    const width = Math.max(...system.map((l) => l.length))
    // The struck columns of this system, by character position.
    const struck: { x: number; notes: TabNote[] }[] = []
    for (let x = 0; x < width; x++) {
      const notes: TabNote[] = []
      system.forEach((line, i) => {
        const c = line[x]
        // The first digit of a number counts; the second is read with it and skipped.
        if (c === undefined || !/\d/.test(c) || (x > 0 && /\d/.test(line[x - 1]!))) return
        const two = line[x + 1] !== undefined && /\d/.test(line[x + 1]!) ? line.slice(x, x + 2) : c
        const fret = Number(two)
        if (fret <= 24) notes.push({ string: STRINGS_PER_SYSTEM - 1 - i, fret })
      })
      if (notes.length > 0) struck.push({ x, notes })
    }
    if (struck.length === 0) continue
    // Bars: the body between bar lines, taken from the longest line. A bar with nothing in it
    // (the trailing one after a closing "|") does not count.
    const longest = system.reduce((a, b) => (b.length > a.length ? b : a), "")
    const bars: { from: number; to: number }[] = []
    let from = 0
    for (let x = 0; x <= longest.length; x++)
      if (x === longest.length || longest[x] === "|") {
        if (x > from) bars.push({ from, to: x })
        from = x + 1
      }
    const firstNote = struck[0]!.x
    const timed = struck.map(({ x, notes }) => {
      const bar = Math.max(
        0,
        bars.findIndex((b) => x >= b.from && x < b.to),
      )
      const { from: barFrom, to } = bars[bar] ?? { from: 0, to: width }
      // The first note of the tab starts its bar: what precedes it is the writer's margin.
      const lead = bar === 0 ? Math.max(0, firstNote - barFrom) : 0
      const span = Math.max(1, to - barFrom - lead)
      const step =
        bar * STEPS_PER_PATTERN + Math.floor(((x - barFrom - lead) * STEPS_PER_PATTERN) / span)
      return { step, notes }
    })
    const collides = timed.some((t, i) => i > 0 && t.step <= timed[i - 1]!.step)
    const placed = collides ? struck.map(({ notes }, i) => ({ step: i, notes })) : timed
    for (const { step, notes } of placed) columns.push(column(notes, base + step))
    const last = placed[placed.length - 1]!.step
    base += (Math.floor(last / STEPS_PER_PATTERN) + 1) * STEPS_PER_PATTERN
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

/**
 * The tab as poly-grid patterns for a key: every column at its step (the
 * rows of its notes, those the key has), sixteen steps a pattern, as many
 * patterns as the tab is long.
 */
export function tabToPatterns(columns: readonly TabColumn[], key: KeyParams): number[][][] {
  const rowOf = new Map(keyRows(key).map((name, row) => [midiOfName(name), row]))
  const last = columns.length > 0 ? columns[columns.length - 1]!.step : 0
  const patterns: number[][][] = Array.from(
    { length: Math.floor(last / STEPS_PER_PATTERN) + 1 },
    () => Array.from({ length: STEPS_PER_PATTERN }, () => [] as number[]),
  )
  for (const col of columns) {
    const rows = [
      ...new Set(col.map((n) => rowOf.get(tabMidi(n))).filter((r): r is number => r !== undefined)),
    ].sort((a, b) => a - b)
    const pattern = patterns[Math.floor(col.step / STEPS_PER_PATTERN)]!
    const step = col.step % STEPS_PER_PATTERN
    pattern[step] = [...new Set([...pattern[step]!, ...rows])].sort((a, b) => a - b)
  }
  return patterns
}
