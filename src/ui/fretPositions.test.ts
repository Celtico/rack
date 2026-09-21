import { describe, expect, it } from "vitest"

import { midiOf, noteAt, positionOf, tabLines } from "./fretPositions"

describe("fretPositions", () => {
  it("reads note names as MIDI numbers", () => {
    expect(midiOf("C4")).toBe(60)
    expect(midiOf("E2")).toBe(40)
    expect(midiOf("F#4")).toBe(66)
    expect(midiOf("Eb2")).toBe(39)
    expect(midiOf("Accent")).toBeNull()
  })

  it("places a note on the lowest fret that reaches it, open strings first", () => {
    expect(positionOf("E2")).toEqual({ string: 0, fret: 0 })
    expect(positionOf("G4")).toEqual({ string: 5, fret: 3 })
    expect(positionOf("B3")).toEqual({ string: 4, fret: 0 })
    expect(positionOf("C3")).toEqual({ string: 1, fret: 3 })
    expect(positionOf("E5")).toEqual({ string: 5, fret: 12 })
  })

  it("names the note at a string and fret, in the spelling asked for", () => {
    expect(noteAt(5, 3)).toBe("G4")
    expect(noteAt(0, 0)).toBe("E2")
    expect(noteAt(1, 1)).toBe("Bb2")
    expect(noteAt(1, 1, true)).toBe("A#2")
    expect(noteAt(4, 12)).toBe("B4")
  })

  it("has no place for notes off the neck", () => {
    expect(positionOf("D2")).toBeNull()
    expect(positionOf("F5")).toBeNull()
    expect(positionOf("Slide")).toBeNull()
  })
})

describe("tabLines", () => {
  it("prints the notes as a tablature, high string on top, one column each", () => {
    const lines = tabLines(
      [
        { string: 3, fret: 2 },
        { string: 5, fret: 0 },
        { string: 4, fret: 12 },
      ],
      4,
    )
    expect(lines).toEqual([
      "e|----0-------|",
      "B|------12----|",
      "G|-2----------|",
      "D|------------|",
      "A|------------|",
      "E|------------|",
    ])
  })

  it("grows past the columns asked for when there are more notes", () => {
    const many = Array.from({ length: 20 }, () => ({ string: 0, fret: 1 }))
    expect(tabLines(many)[5]).toBe(`E|${"-1-".repeat(20)}|`)
    expect(tabLines([])[0]).toBe(`e|${"---".repeat(16)}|`)
  })
})
