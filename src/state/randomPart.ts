import {
  BASS_NOTES,
  emptyTrack,
  PAD_IDS,
  POLY_NOTES,
  STEP_COUNT,
  SYNTH_NOTES,
  type BassRow,
  type Kind,
  type KitRows,
  type PolyRow,
  type SynthRow,
  type Track,
} from "./pattern"
import type { Rng } from "./random"

/**
 * A random part for one bar — with a little sense: notes land on the beat
 * more than off it, a line walks in small steps, chords are stacked thirds in
 * the instrument's scale, a kit keeps a kick and a snare where a beat wants
 * them. Pure: the rng decides everything.
 */

/** How likely a step is to sound, by where it sits in the bar. */
const onBeat = (step: number, beat: number, half: number, off: number) =>
  step % 4 === 0 ? beat : step % 2 === 0 ? half : off

const walk = (row: number, rows: number, rng: Rng): number => {
  // Mostly a step or two, now and then a leap; never off the grid.
  const r = rng()
  const move = r < 0.35 ? 0 : r < 0.6 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 2 : r < 0.97 ? -2 : 4
  const next = row + move
  return next < 0 ? -next : next >= rows ? rows - 1 - (next - rows + 1) : next
}

/** A monophonic line over `rows` scale notes: a walk, with rests. */
export function randomLine(rows: number, rng: Rng): SynthRow {
  const out: (number | null)[] = []
  let row = Math.floor(rng() * rows)
  for (let step = 0; step < STEP_COUNT; step++) {
    if (rng() < onBeat(step, 0.85, 0.55, 0.3)) {
      // The bar's first beat likes the root.
      row = step === 0 && rng() < 0.6 ? 0 : walk(row, rows, rng)
      out.push(row)
    } else {
      out.push(null)
    }
  }
  return out
}

/** An acid line: the walk, plus accents and slides into the next note. */
export function randomBass(rng: Rng): BassRow {
  const notes = randomLine(BASS_NOTES.length, rng)
  const accent = notes.map((n) => n !== null && rng() < 0.25)
  const slide = notes.map(
    (n, i) => n !== null && notes[(i + 1) % STEP_COUNT] !== null && rng() < 0.2,
  )
  return { notes, accent, slide }
}

/** Chords of stacked thirds (every other scale row), mostly on the beat. */
export function randomChords(rows: number, rng: Rng): PolyRow {
  const out: number[][] = []
  for (let step = 0; step < STEP_COUNT; step++) {
    if (rng() >= onBeat(step, 0.7, 0.3, 0.08)) {
      out.push([])
      continue
    }
    const root = Math.floor(rng() * Math.max(1, rows - 4))
    const chord = [root, root + 2, root + 4].filter((r) => r < rows)
    // Sometimes a dyad, sometimes the seventh on top.
    if (rng() < 0.3 && chord.length > 2) chord.pop()
    else if (rng() < 0.25 && root + 6 < rows) chord.push(root + 6)
    out.push(chord)
  }
  return out
}

const row = (chance: (step: number) => number, rng: Rng): boolean[] =>
  Array.from({ length: STEP_COUNT }, (_, step) => rng() < chance(step))

/** DR-4: a beat — kick on the one, snare on two and four, hats around them. */
export function randomDrums(rng: Rng): KitRows {
  return {
    kick: row(
      (s) => (s === 0 ? 0.95 : s === 8 ? 0.8 : s % 4 === 0 ? 0.2 : s % 2 === 0 ? 0.15 : 0.05),
      rng,
    ),
    snare: row((s) => (s === 4 || s === 12 ? 0.9 : s % 2 === 1 ? 0.06 : 0.03), rng),
    clap: row((s) => (s === 4 || s === 12 ? 0.35 : 0.03), rng),
    hat: row((s) => (s % 2 === 0 ? 0.7 : 0.3), rng),
  }
}

/** PERC-6: sparse hits, a shaker on the off-beats, a crash on the one now and then. */
export function randomPerc(rng: Rng): KitRows {
  return {
    tomLo: row((s) => (s % 4 === 2 ? 0.2 : 0.06), rng),
    tomHi: row((s) => (s % 4 === 3 ? 0.2 : 0.06), rng),
    rim: row((s) => (s % 4 === 2 ? 0.3 : 0.08), rng),
    cowbell: row((s) => (s % 4 === 0 ? 0.25 : 0.05), rng),
    shaker: row((s) => (s % 2 === 1 ? 0.55 : 0.1), rng),
    crash: row((s) => (s === 0 ? 0.3 : 0.01), rng),
  }
}

/** SMP-8: the first pads a little busier, the rest scattered. */
export function randomPads(rng: Rng): KitRows {
  return Object.fromEntries(
    PAD_IDS.map((pad, i) => [pad, row((s) => (i < 2 ? onBeat(s, 0.5, 0.25, 0.1) : 0.08), rng)]),
  )
}

/** A random part of the kind, one bar long. */
export function randomTrack(kind: Kind, rng: Rng): Track {
  switch (kind) {
    case "drums":
      return { kind, rows: randomDrums(rng) } as Track
    case "perc":
      return { kind, rows: randomPerc(rng) } as Track
    case "sampler":
      return { kind, rows: randomPads(rng) } as Track
    case "synth":
      return { kind, notes: randomLine(SYNTH_NOTES.length, rng) }
    case "bass":
      return { kind, bass: randomBass(rng) }
    case "poly":
    case "ep":
    case "strings":
      return { kind, chords: randomChords(POLY_NOTES[kind].length, rng) } as Track
  }
  return emptyTrack(kind)
}
