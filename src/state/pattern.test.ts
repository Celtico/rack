import { describe, expect, it } from "vitest"

import {
  bassEventAt,
  createEmptyPattern,
  synthNoteAt,
  toggleBassFlag,
  toggleBassNote,
  togglePercStep,
  toggleSynthNote,
} from "./pattern"

describe("BASS-2 row", () => {
  it("keeps one note per column and flips flags independently", () => {
    let p = createEmptyPattern()
    p = toggleBassNote(p, 2, 1)
    p = toggleBassNote(p, 2, 6)
    p = toggleBassFlag(p, 2, "slide")
    expect(p.bass.notes[2]).toBe(6)
    expect(p.bass.slide[2]).toBe(true)
    expect(p.bass.accent[2]).toBe(false)
    expect(bassEventAt(p, 2)).toEqual({ note: "G2", accent: false, slide: true })
    expect(bassEventAt(p, 3)).toEqual({ note: null, accent: false, slide: false })

    p = toggleBassNote(p, 2, 6)
    expect(p.bass.notes[2]).toBeNull()
    // Flags survive clearing the note, so a rest can still be marked.
    expect(p.bass.slide[2]).toBe(true)
  })
})

describe("togglePercStep", () => {
  it("flips one PERC-6 step without touching other kits or mutating the input", () => {
    const before = createEmptyPattern()
    const after = togglePercStep(before, "cowbell", 6)
    expect(after.perc.cowbell[6]).toBe(true)
    expect(before.perc.cowbell[6]).toBe(false)
    expect(after.perc.shaker).toBe(before.perc.shaker)
    expect(after.drums).toBe(before.drums)
    expect(togglePercStep(after, "cowbell", 6).perc.cowbell[6]).toBe(false)
  })
})

describe("toggleSynthNote", () => {
  it("keeps at most one note per column", () => {
    let p = createEmptyPattern()
    p = toggleSynthNote(p, 4, 2)
    expect(p.synth[4]).toBe(2)

    p = toggleSynthNote(p, 4, 6)
    expect(p.synth[4]).toBe(6)
    expect(p.synth.filter((r) => r !== null)).toHaveLength(1)
  })

  it("clears the column when the same row is set again", () => {
    let p = createEmptyPattern()
    p = toggleSynthNote(p, 0, 3)
    p = toggleSynthNote(p, 0, 3)
    expect(p.synth[0]).toBeNull()
  })

  it("never mutates the input", () => {
    const before = createEmptyPattern()
    const after = toggleSynthNote(before, 1, 1)
    expect(after).not.toBe(before)
    expect(after.synth).not.toBe(before.synth)
    expect(before.synth[1]).toBeNull()
    expect(after.drums).toBe(before.drums)
  })
})

describe("synthNoteAt", () => {
  it("maps row indices to note names and rests to null", () => {
    let p = createEmptyPattern()
    p = toggleSynthNote(p, 2, 0)
    p = toggleSynthNote(p, 3, 7)
    expect(synthNoteAt(p, 2)).toBe("C2")
    expect(synthNoteAt(p, 3)).toBe("C3")
    expect(synthNoteAt(p, 4)).toBeNull()
  })
})
