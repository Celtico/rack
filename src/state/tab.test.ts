import { describe, expect, it } from "vitest"

import { parseTab, pickKeyFor, tabMidi, tabToPatterns } from "./tab"

const ARPEGGIO = `
E|---0---0----0---0----0---0---0---0--------|
B|-----0--------0--------0-------0----------|
G|-2--------2--------2-------2--------------|
D|------------------------------------------|
A|------------------------------------------|
E|------------------------------------------|
`

describe("parseTab", () => {
  it("reads the columns left to right, one note each, the thin E as string 5", () => {
    const columns = parseTab(ARPEGGIO)
    expect(columns).toHaveLength(16)
    expect(columns[0]).toEqual([{ string: 3, fret: 2 }])
    expect(columns[1]).toEqual([{ string: 5, fret: 0 }])
    expect(columns[2]).toEqual([{ string: 4, fret: 0 }])
    expect(columns[3]).toEqual([{ string: 5, fret: 0 }])
    expect(columns[15]).toEqual([{ string: 5, fret: 0 }])
  })

  it("skips a chord name above and a fingering line below", () => {
    const text = `A9    \n${ARPEGGIO.trim()} \n   p i p i\n`
    expect(parseTab(text)).toEqual(parseTab(ARPEGGIO))
  })

  it("reads two-digit frets, chords in a column, several systems, and skips other text", () => {
    const text = `Intro (Capo 2)
e|--12--0--|
B|--1---0--|
G|------0--|
D|---------|
A|---------|
E|--0------|

e|--3--|
B|-----|
G|-----|
D|-----|
A|-----|
E|-----|
`
    const columns = parseTab(text)
    expect(columns).toEqual([
      [
        { string: 5, fret: 12 },
        { string: 4, fret: 1 },
        { string: 0, fret: 0 },
      ],
      [
        { string: 5, fret: 0 },
        { string: 4, fret: 0 },
        { string: 3, fret: 0 },
      ],
      [{ string: 5, fret: 3 }],
    ])
    expect(tabMidi({ string: 5, fret: 12 })).toBe(76)
  })
})

describe("pickKeyFor / tabToPatterns", () => {
  it("finds a key whose rows hold the tab's notes and lays them out a step each", () => {
    const columns = parseTab(ARPEGGIO)
    const { key, covered, dropped } = pickKeyFor(columns)
    expect(covered).toBe(3)
    expect(dropped).toBe(0)
    // A3 is the lowest note: a key on A at octave 3 (A3 … A4) over the others that hold all three;
    // with no third in the tab, major and minor tie and the plainer (major) wins.
    expect(key.root).toBe(9)
    expect(key.octave).toBe(3)
    const patterns = tabToPatterns(columns, key)
    expect(patterns).toHaveLength(1)
    expect(patterns[0]!.every((step) => step.length === 1)).toBe(true)
    // The three pitches map to three distinct rows, the same row for the same note every time.
    expect(patterns[0]![1]).toEqual(patterns[0]![3])
    expect(new Set(patterns[0]!.map((s) => s[0])).size).toBe(3)
  })

  it("spills a long tab into more patterns and drops what the key cannot hold", () => {
    const columns = Array.from({ length: 20 }, (_, i) => [{ string: 5, fret: i % 12 }])
    const choice = pickKeyFor(columns)
    expect(choice.covered).toBeLessThanOrEqual(8)
    expect(choice.dropped).toBe(12 - choice.covered)
    const patterns = tabToPatterns(columns, choice.key)
    expect(patterns).toHaveLength(2)
    expect(patterns[1]).toHaveLength(16)
  })
})
