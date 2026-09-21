import { describe, expect, it } from "vitest"

import {
  clampKey,
  keyRows,
  noteLabel,
  noteName,
  solfege,
  solfegeShort,
  spelledWithSharps,
} from "./key"
import { KEY_DEFAULT, LEGACY_ROWS, rowNotes } from "./pattern"

describe("keys", () => {
  it("lays a key's scale over eight rows, carrying on into the next octave", () => {
    expect(keyRows({ root: 0, scale: "major", octave: 4 })).toEqual([
      "C4",
      "D4",
      "E4",
      "F4",
      "G4",
      "A4",
      "B4",
      "C5",
    ])
    expect(keyRows({ root: 5, scale: "minor", octave: 3 })).toEqual([
      "F3",
      "G3",
      "Ab3",
      "Bb3",
      "C4",
      "Db4",
      "Eb4",
      "F4",
    ])
    // A pentatonic runs past the octave and a half.
    expect(keyRows({ root: 4, scale: "minorPentatonic", octave: 1 })).toEqual(LEGACY_ROWS.bass)
  })

  it("keeps the fixed rows of the machines whose default key matches them", () => {
    expect(keyRows(KEY_DEFAULT.synth)).toEqual(LEGACY_ROWS.synth)
    expect(keyRows(KEY_DEFAULT.bass)).toEqual(LEGACY_ROWS.bass)
    expect(keyRows(KEY_DEFAULT.poly)).toEqual(LEGACY_ROWS.poly)
    // Without a key a machine plays its fixed rows, whatever the kind.
    expect(rowNotes("ep", undefined)).toBe(LEGACY_ROWS.ep)
    expect(rowNotes("ep", { root: 0, scale: "major", octave: 3 })[3]).toBe("F3")
  })

  it("names notes across octave lines and reads them in solfège, sharps included", () => {
    expect(noteName(11, 2)).toBe("B2")
    expect(noteName(13, 2)).toBe("Db3")
    expect(noteName(13, 2, true)).toBe("C#3")
    expect(solfege("Eb2")).toBe("Mib2")
    expect(solfege("F#3")).toBe("Fa#3")
    expect(solfege("C4")).toBe("Do4")
    expect(solfege("Bb")).toBe("Sib")
    expect(solfege("Accent")).toBe("Accent")
    expect(solfegeShort("Eb2")).toBe("Mib")
    expect(solfegeShort("F#3")).toBe("Fa#")
    expect(solfegeShort("C-1")).toBe("Do")
    expect(noteLabel("G2")).toBe("Sol2 · G")
    expect(noteLabel("F#3")).toBe("Fa#3 · F#")
  })

  it("spells a key's rows with the sharps or flats of its signature", () => {
    // G major has one sharp: F#, never Gb. E minor shares it. F minor is all flats.
    expect(keyRows({ root: 7, scale: "major", octave: 2 })).toEqual([
      "G2",
      "A2",
      "B2",
      "C3",
      "D3",
      "E3",
      "F#3",
      "G3",
    ])
    expect(spelledWithSharps({ root: 4, scale: "minor" })).toBe(true)
    expect(spelledWithSharps({ root: 5, scale: "minor" })).toBe(false)
    expect(spelledWithSharps({ root: 2, scale: "dorian" })).toBe(false)
    expect(spelledWithSharps({ root: 9, scale: "mixolydian" })).toBe(true)
  })

  it("pulls a key into range and falls back on a nonsense scale", () => {
    const fallback = KEY_DEFAULT.synth
    expect(clampKey({ root: 14, scale: "lydian" as never, octave: -3 }, fallback)).toEqual({
      root: 11,
      scale: "minor",
      octave: 0,
    })
    expect(clampKey({}, fallback)).toEqual(fallback)
  })
})
