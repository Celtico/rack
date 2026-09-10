import { describe, expect, it } from "vitest"

import { createEmptyPattern, synthNoteAt, toggleSynthNote } from "./pattern"

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
