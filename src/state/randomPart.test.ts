import { describe, expect, it } from "vitest"

import { STEP_COUNT, SYNTH_NOTES } from "./pattern"
import { randomBass, randomChords, randomDrums, randomLine, randomTrack } from "./randomPart"

/** A deterministic rng: a fixed cycle. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]!
}
/** A cheap pseudo-random with a seed, for shape tests that need variety. */
const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe("random part", () => {
  it("writes a line that stays on the grid, sixteen steps long", () => {
    for (const rng of [() => 0, () => 0.999, lcg(1), lcg(7)]) {
      const line = randomLine(SYNTH_NOTES.length, rng)
      expect(line).toHaveLength(STEP_COUNT)
      for (const r of line) if (r !== null) expect(r).toBeGreaterThanOrEqual(0)
      for (const r of line) if (r !== null) expect(r).toBeLessThan(SYNTH_NOTES.length)
    }
    // An always-low rng: every step sounds, and the first beat lands on the root.
    expect(randomLine(8, () => 0)[0]).toBe(0)
    expect(randomLine(8, () => 0).every((r) => r !== null)).toBe(true)
    // An always-high rng: silence.
    expect(randomLine(8, () => 0.999).every((r) => r === null)).toBe(true)
  })

  it("slides only into a following note", () => {
    const bass = randomBass(lcg(3))
    bass.slide.forEach((s, i) => {
      if (s) {
        expect(bass.notes[i]).not.toBeNull()
        expect(bass.notes[(i + 1) % STEP_COUNT]).not.toBeNull()
      }
    })
    bass.accent.forEach((a, i) => {
      if (a) expect(bass.notes[i]).not.toBeNull()
    })
  })

  it("stacks chords in thirds within the instrument's rows", () => {
    const chords = randomChords(8, seq(0, 0.2, 0.9, 0.9))
    for (const chord of chords) {
      if (chord.length === 0) continue
      expect(chord.every((r) => r >= 0 && r < 8)).toBe(true)
      for (let i = 1; i < chord.length; i++) expect(chord[i]! - chord[i - 1]!).toBe(2)
    }
    expect(chords.some((c) => c.length >= 2)).toBe(true)
  })

  it("keeps a kick on the one and a snare on the backbeat when the dice allow it", () => {
    const rows = randomDrums(() => 0.5)
    expect(rows.kick![0]).toBe(true)
    expect(rows.snare![4]).toBe(true)
    expect(rows.snare![12]).toBe(true)
    expect(rows.snare![1]).toBe(false)
  })

  it("returns a track of the right shape for every kind", () => {
    const rng = lcg(11)
    expect(randomTrack("synth", rng)).toMatchObject({ kind: "synth" })
    expect(randomTrack("bass", rng)).toMatchObject({ kind: "bass" })
    expect(randomTrack("ep", rng)).toMatchObject({ kind: "ep" })
    expect(randomTrack("perc", rng)).toMatchObject({ kind: "perc" })
    const pads = randomTrack("sampler", rng)
    expect("rows" in pads && Object.keys(pads.rows)).toHaveLength(8)
  })
})
