/**
 * Where a note falls on a guitar — pure. Standard tuning, the first twelve
 * frets; a note is placed on the lowest fret that reaches it (open strings
 * first), the way a first-position chord poster does.
 */

import { pitchName } from "../state/key"

/** Standard tuning, low to high: what each open string sounds. */
export const TUNING = ["E2", "A2", "D3", "G3", "B3", "E4"] as const
export const STRING_COUNT = TUNING.length
/** The strings as a tablature names them, low to high: the thin E is "e". */
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const
/** Frets drawn, past the nut. */
export const FRET_COUNT = 12
/** The inlay markers a neck carries. */
export const MARKER_FRETS = [3, 5, 7, 9, 12] as const

const LETTER_PITCH: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "F#4" → 66, "Eb2" → 39 (MIDI numbers; C4 = 60); null for anything that is not a note. */
export function midiOf(note: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note)
  if (!m) return null
  const pitch = LETTER_PITCH[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0)
  return (Number(m[3]) + 1) * 12 + pitch
}

/** "String 1 fret 3" → the note there, spelled with sharps or flats (`sharps`): "G4", "Bb2". */
export function noteAt(string: number, fret: number, sharps = false): string {
  const midi = OPEN[string]! + fret
  return `${pitchName(midi % 12, sharps)}${Math.floor(midi / 12) - 1}`
}

const OPEN = TUNING.map((n) => midiOf(n)!)

export interface Position {
  /** 0 = low E … 5 = high E. */
  string: number
  /** 0 = open. */
  fret: number
}

/**
 * The lowest-fret place for a note within the first `FRET_COUNT` frets, or
 * null when the neck does not reach it (below the low E, above the 12th
 * fret of the high E).
 */
export function positionOf(note: string): Position | null {
  const midi = midiOf(note)
  if (midi === null) return null
  let best: Position | null = null
  OPEN.forEach((open, string) => {
    const fret = midi - open
    if (fret < 0 || fret > FRET_COUNT) return
    if (!best || fret < best.fret) best = { string, fret }
  })
  return best
}

/**
 * A tablature of notes in the order given, as text: six lines, high string on
 * top, one column of three characters per note ("-3-", "12-", "---"), at
 * least `columns` columns, "e|" … "|" around them — what a tab site prints.
 */
export function tabLines(
  notes: readonly { string: number; fret: number }[],
  columns = 16,
): string[] {
  const width = Math.max(columns, notes.length)
  return [...STRING_NAMES]
    .map((name, string) => {
      const cells = Array.from({ length: width }, (_, i) => {
        const note = notes[i]
        if (!note || note.string !== string) return "---"
        return note.fret < 10 ? `-${note.fret}-` : `${note.fret}-`
      })
      return `${name}|${cells.join("")}|`
    })
    .reverse()
}
