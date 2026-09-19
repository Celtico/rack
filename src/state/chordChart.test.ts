import { describe, expect, it } from "vitest"

import {
  CHART_DEFAULTS,
  chartToSong,
  chordRows,
  ChordChartError,
  equivalences,
  parseChart,
  parseChord,
} from "./chordChart"
import { keyRows } from "./key"
import type { PolyTrack } from "./pattern"

const D_MAJOR = { root: 2, scale: "major" as const, octave: 3 }

describe("chord names", () => {
  it("reads international and Brazilian spellings", () => {
    expect(parseChord("D")).toMatchObject({ root: 2, intervals: [0, 4, 7] })
    expect(parseChord("Em7")).toMatchObject({ root: 4, intervals: [0, 3, 7, 10] })
    expect(parseChord("D7+")).toMatchObject({ root: 2, intervals: [0, 4, 7, 11] })
    expect(parseChord("Dmaj7")?.intervals).toEqual([0, 4, 7, 11])
    expect(parseChord("A4")?.intervals).toEqual([0, 5, 7])
    expect(parseChord("Asus4")?.intervals).toEqual([0, 5, 7])
    expect(parseChord("D9")?.intervals).toEqual([0, 4, 7, 10, 14])
    expect(parseChord("Dadd9")?.intervals).toEqual([0, 4, 7, 14])
    expect(parseChord("F#m7(b5)")).toMatchObject({ root: 6, intervals: [0, 3, 6, 10] })
    expect(parseChord("C#dim")).toMatchObject({ root: 1, intervals: [0, 3, 6] })
    expect(parseChord("Bb")).toMatchObject({ root: 10 })
    expect(parseChord("G/B")).toMatchObject({ root: 7, bass: 11 })
    expect(parseChord("C(9)")?.intervals).toEqual([0, 4, 7, 14])
    expect(parseChord("E5")?.intervals).toEqual([0, 7])
  })

  it("rejects what is not a chord", () => {
    expect(parseChord("Shakedown")).toBeNull()
    expect(parseChord("e|---3---")).toBeNull()
    expect(parseChord("H")).toBeNull()
    expect(parseChord("Dxyz")).toBeNull()
  })
})

describe("equivalences", () => {
  it("puts a chord on the rows of the key, stacked up from the root", () => {
    // D major, octave 3: D3 E3 F#3 G3 A3 B3 C#4 D4
    expect(keyRows(D_MAJOR)).toEqual(["D3", "E3", "F#3", "G3", "A3", "B3", "C#4", "D4"])
    expect(chordRows(parseChord("D7+")!, D_MAJOR)).toEqual({
      rows: [0, 2, 4, 6],
      bassRow: 0,
      dropped: [],
    })
    expect(chordRows(parseChord("A4")!, D_MAJOR)).toEqual({
      rows: [1, 4, 7],
      bassRow: 4,
      dropped: [],
    })
    expect(chordRows(parseChord("G")!, D_MAJOR)).toEqual({
      rows: [3, 5, 7],
      bassRow: 3,
      dropped: [],
    })
    expect(chordRows(parseChord("Em7")!, D_MAJOR)).toEqual({
      rows: [1, 3, 5, 7],
      bassRow: 1,
      dropped: [],
    })
    expect(chordRows(parseChord("B4")!, D_MAJOR)).toEqual({
      rows: [1, 2, 5],
      bassRow: 5,
      dropped: [],
    })
    // A slash bass picks the bass row; the chord itself stays.
    expect(chordRows(parseChord("D/F#")!, D_MAJOR)).toMatchObject({ rows: [0, 2, 4], bassRow: 2 })
  })

  it("drops the notes the key has no row for and says which", () => {
    // D9's seventh is C natural — not in D major.
    expect(chordRows(parseChord("D9")!, D_MAJOR)).toEqual({
      rows: [0, 1, 2, 4],
      bassRow: 0,
      dropped: ["C"],
    })
    // A chord from another key altogether: its root has no row, so the bass rests.
    expect(chordRows(parseChord("Bb")!, D_MAJOR)).toMatchObject({
      bassRow: null,
      dropped: ["Bb", "F"],
    })
  })
})

const CHART = `
Tom: Eb
Capotraste na 1ª casa

[Intro] D7+ D9 A4 G

[Verse]
D7+        D9        A4    G
Shakedown 1979, cool kids never have the time
Em7  A4
On a live wire right up off the street

Refrão:
D7+ | A4 | G | D7+ | A4 | G | Em7 | A4  2x

e|---2---3---|
`

describe("charts", () => {
  it("reads sections, chord lines, repeats, the key and the capo; skips lyrics and tabs", () => {
    const chart = parseChart(CHART)
    // "Tom: Eb" with the capo on 1: the chords are written as D shapes.
    expect(chart.root).toBe(2)
    expect(chart.scale).toBe("major")
    expect(chart.capo).toBe(1)
    expect(chart.sections.map((s) => [s.name, s.chords.length])).toEqual([
      ["Intro", 4],
      ["Verse", 6],
      ["Refrão", 16],
    ])
    expect(chart.sections[1]!.chords).toEqual(["D7+", "D9", "A4", "G", "Em7", "A4"])
  })

  it("lists every distinct chord once, in order, unknown ones flagged", () => {
    const table = equivalences(parseChart("[Intro] D7+ D9 A4 G D7+ Xyz"), D_MAJOR)
    expect(table.map((e) => e.chord)).toEqual(["D7+", "D9", "A4", "G", "Xyz"])
    expect(table[0]).toMatchObject({ notes: ["D", "F#", "A", "C#"], rows: [0, 2, 4, 6] })
    expect(table[4]!.unknown).toBe(true)
  })

  it("builds a song: a pattern per distinct bar, the chain and sections as written, the capo as tune", () => {
    const { song, equivalences: table } = chartToSong(parseChart(CHART), {
      ...CHART_DEFAULTS,
      key: D_MAJOR,
      capo: 1,
      bpm: 126,
      strum: "eighths",
      parts: { bass: true, guitar: true, piano: true, pad: false },
    })
    expect(table).toHaveLength(5)
    expect(song.chain).toHaveLength(26)
    expect(song.sections).toEqual([
      { name: "Intro", bars: 4 },
      { name: "Verse", bars: 6 },
      { name: "Refrão", bars: 16 },
    ])
    // Five chords → five distinct bars, the rest of the bank silent.
    expect(new Set(song.chain).size).toBe(5)
    expect(song.instances.map((i) => i.id)).toEqual(["drums-1", "bass-1", "strings-1", "ep-1"])
    for (const inst of song.instances) {
      if (inst.kind === "drums") continue
      expect(inst.key).toMatchObject({ root: 2, scale: "major" })
      expect(inst.mod.tune).toBe(1)
    }
    // Bar 0 is D7+: the guitar strums its rows on every eighth, the bass plays the root on the beats.
    const first = song.patterns[song.chain[0]!]!
    const guitar = first.tracks["strings-1"] as PolyTrack
    expect(guitar.chords[0]).toEqual([0, 2, 4, 6])
    expect(guitar.chords[2]).toEqual([0, 2, 4, 6])
    expect(guitar.chords[1]).toEqual([])
    const bass = first.tracks["bass-1"]!
    expect(bass.kind === "bass" && bass.bass.notes.slice(0, 5)).toEqual([0, null, null, null, 0])
    expect(bass.kind === "bass" && bass.bass.accent[0]).toBe(true)
    expect(song.bpm).toBe(126)
  })

  it("puts two chords in a bar when asked, and refuses a chart with no chords", () => {
    const { song } = chartToSong(parseChart("[A] D G | A D"), {
      ...CHART_DEFAULTS,
      key: D_MAJOR,
      chordsPerBar: 2,
    })
    expect(song.chain).toEqual([0, 1])
    const bar = song.patterns[0]!.tracks["strings-1"] as PolyTrack
    expect(bar.chords[0]).toEqual([0, 2, 4])
    expect(bar.chords[8]).toEqual([3, 5, 7])
    expect(() => chartToSong(parseChart("just words here"), CHART_DEFAULTS)).toThrow(
      ChordChartError,
    )
  })
})
