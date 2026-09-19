/**
 * Keys and scales — pure. A melodic machine's eight grid rows are the notes
 * of a key: a root, a scale and the octave the first row sits in. Without a
 * key a machine keeps the fixed rows it always had (`pattern.ts`), so older
 * songs sound as they did.
 */

export const ROW_COUNT = 8

/** Pitch classes from C, spelled with flats — what Tone reads and what the row labels print. */
export const PITCH_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const

/** The same twelve in solfège, as a score is read here. */
export const SOLFEGE_NAMES = [
  "Do",
  "Reb",
  "Re",
  "Mib",
  "Mi",
  "Fa",
  "Solb",
  "Sol",
  "Lab",
  "La",
  "Sib",
  "Si",
] as const

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
} as const satisfies Record<string, readonly number[]>

export type ScaleName = keyof typeof SCALES
export const SCALE_NAMES = Object.keys(SCALES) as ScaleName[]
export const isScaleName = (v: unknown): v is ScaleName =>
  typeof v === "string" && Object.hasOwn(SCALES, v)

export const SCALE_LABELS: Readonly<Record<ScaleName, string>> = {
  major: "Major",
  minor: "Minor",
  harmonicMinor: "Harmonic minor",
  dorian: "Dorian",
  mixolydian: "Mixolydian",
  majorPentatonic: "Pentatonic major",
  minorPentatonic: "Pentatonic minor",
  blues: "Blues",
}

export interface KeyParams {
  /** Pitch class of the root, 0 = C … 11 = B. */
  root: number
  scale: ScaleName
  /** Octave of the first (lowest) row, scientific: 4 holds middle C. */
  octave: number
}

export const KEY_RANGES = { root: { min: 0, max: 11 }, octave: { min: 0, max: 6 } } as const

const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)))

/** A key pulled into range; a scale name that is not one becomes the fallback's. */
export function clampKey(key: Partial<KeyParams>, fallback: KeyParams): KeyParams {
  return {
    root: clampInt(key.root ?? fallback.root, KEY_RANGES.root.min, KEY_RANGES.root.max),
    scale: isScaleName(key.scale) ? key.scale : fallback.scale,
    octave: clampInt(key.octave ?? fallback.octave, KEY_RANGES.octave.min, KEY_RANGES.octave.max),
  }
}

/** A note name such as "Eb2" for a MIDI-style absolute pitch class + octave. */
export const noteName = (pitch: number, octave: number): string =>
  `${PITCH_NAMES[((pitch % 12) + 12) % 12]}${octave + Math.floor(pitch / 12)}`

/**
 * The eight rows of a key, low to high: the scale's degrees from the root at
 * `octave`, carrying on into the next octave once the scale runs out.
 */
export function keyRows(key: KeyParams, count = ROW_COUNT): string[] {
  const steps = SCALES[key.scale]
  return Array.from({ length: count }, (_, i) => {
    const degree = i % steps.length
    const wrap = Math.floor(i / steps.length)
    return noteName(key.root + steps[degree]! + wrap * 12, key.octave)
  })
}

/** "Eb2" → "Mib2": the row label as a score names it. */
export function solfege(note: string): string {
  const m = /^([A-G])(b?)(-?\d+)$/.exec(note)
  if (!m) return note
  const index = PITCH_NAMES.indexOf(`${m[1]}${m[2]}` as (typeof PITCH_NAMES)[number])
  return index < 0 ? note : `${SOLFEGE_NAMES[index]}${m[3]}`
}
