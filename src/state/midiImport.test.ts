import { Midi } from "@tonejs/midi"
import { describe, expect, it } from "vitest"

import {
  importMidi,
  isPercussion,
  midiOf,
  MidiImportError,
  nearestRow,
  songFromMidi,
} from "./midiImport"
import { parseSong, serializeSong } from "./song"

const PPQ = 480
const step = (n: number) => (n * PPQ) / 4

function drumsAndBass(): Midi {
  const midi = new Midi()
  midi.header.setTempo(128)
  const drums = midi.addTrack()
  drums.channel = 9
  for (const s of [0, 4, 8, 12]) drums.addNote({ midi: 36, ticks: step(s), durationTicks: step(1) })
  for (const s of [4, 12]) drums.addNote({ midi: 38, ticks: step(s), durationTicks: step(1) })
  drums.addNote({ midi: 42, ticks: step(2), durationTicks: step(1) })
  drums.addNote({ midi: 56, ticks: step(6), durationTicks: step(1) }) // cowbell → perc
  drums.addNote({ midi: 31, ticks: step(7), durationTicks: step(1) }) // sticks: no voice → dropped
  const bass = midi.addTrack()
  bass.instrument.number = 33 // fingered bass
  bass.addNote({ midi: midiOf("E1"), ticks: step(0), durationTicks: step(3), velocity: 0.95 })
  bass.addNote({ midi: midiOf("A1"), ticks: step(8), durationTicks: step(1), velocity: 0.5 })
  bass.addNote({ midi: midiOf("F1"), ticks: step(12), durationTicks: step(1), velocity: 0.5 }) // no F: moved
  // Second bar repeats the first except the bass; a third bar equals the second.
  for (const s of [16, 20, 24, 28])
    drums.addNote({ midi: 36, ticks: step(s), durationTicks: step(1) })
  for (const s of [32, 36, 40, 44])
    drums.addNote({ midi: 36, ticks: step(s), durationTicks: step(1) })
  return midi
}

describe("MIDI import", () => {
  it("maps note names and folds pitches onto an instrument's rows", () => {
    expect(midiOf("C4")).toBe(60)
    expect(midiOf("Eb2")).toBe(39)
    const scale = ["E1", "G1", "A1", "B1", "D2", "E2", "G2", "A2"].map(midiOf)
    expect(nearestRow(midiOf("E3"), scale)).toEqual({ row: 5, moved: false }) // E, nearest octave
    expect(nearestRow(midiOf("F1"), scale)).toEqual({ row: 0, moved: true }) // no F: E1 is a semitone away
  })

  it("puts channel 10 on the kits, a bass program on BASS-2, one pattern per distinct bar", () => {
    const { song, report } = importMidi(drumsAndBass())
    expect(song.bpm).toBe(128)
    expect(song.instances.map((i) => i.kind).sort()).toEqual(["bass", "drums", "perc"])
    const [p0] = song.patterns
    const drums = p0!.tracks["drums-1"]
    const perc = p0!.tracks["perc-1"]
    const bass = p0!.tracks["bass-1"]
    if (drums?.kind !== "drums" || perc?.kind !== "perc" || bass?.kind !== "bass") throw new Error()
    expect(drums.rows.kick.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([0, 4, 8, 12])
    expect(drums.rows.snare[4]).toBe(true)
    expect(drums.rows.hat[2]).toBe(true)
    expect(perc.rows.cowbell[6]).toBe(true)
    // E1 held three steps: same row with slides between, accent from the velocity.
    expect(bass.bass.notes.slice(0, 4)).toEqual([0, 0, 0, null])
    expect(bass.bass.slide.slice(0, 3)).toEqual([true, true, false])
    expect(bass.bass.accent[0]).toBe(true)
    expect(bass.bass.notes[8]).toBe(2) // A1
    expect(bass.bass.notes[12]).toBe(0) // F1 → E1
    expect(report.moved).toBe(1)
    expect(report.dropped).toBe(1)
    // Bars 2 and 3 are identical, so they share a slot.
    expect(song.chain).toEqual([0, 1, 1])
    expect(report.bars).toBe(3)
    expect(song.patterns).toHaveLength(16)
    // The result is a valid song file.
    expect(parseSong(serializeSong(song)).chain).toEqual([0, 1, 1])
  })

  it("puts chords on a poly machine and a piano program on EP-1", () => {
    const midi = new Midi()
    const piano = midi.addTrack()
    piano.instrument.number = 4 // electric piano
    for (const n of ["C4", "E4", "G4"])
      piano.addNote({ midi: midiOf(n), ticks: 0, durationTicks: step(4) })
    const pad = midi.addTrack()
    pad.instrument.number = 89 // pad
    for (const n of ["C3", "E3", "G3"])
      pad.addNote({ midi: midiOf(n), ticks: step(8), durationTicks: step(8) })
    const { song } = importMidi(midi)
    const kinds = song.instances.map((i) => i.kind).sort()
    expect(kinds).toEqual(["ep", "poly"])
    const ep = song.patterns[0]!.tracks["ep-1"]
    const poly = song.patterns[0]!.tracks["poly-1"]
    if (ep?.kind !== "ep" || poly?.kind !== "poly") throw new Error()
    // EP-1 has E4 and G4 but no C4: C folds down to C3, the others stay put.
    expect(ep.chords[0]).toEqual([0, 5, 6])
    expect(poly.chords[8]).toEqual([0, 2, 3]) // C3 E3 G3
    expect(song.chain).toEqual([]) // one bar: just loop it
  })

  it("treats a track named like drums as percussion even off channel 10", () => {
    const midi = new Midi()
    const t = midi.addTrack()
    t.name = "Drums Left"
    t.addNote({ midi: 36, ticks: 0, durationTicks: step(1) })
    t.addNote({ midi: 38, ticks: step(4), durationTicks: step(1) })
    expect(isPercussion(t)).toBe(true)
    const { song } = importMidi(midi)
    expect(song.instances.map((i) => i.kind)).toEqual(["drums"])
  })

  it("rejects bytes that are not MIDI and files with nothing playable", () => {
    expect(() => songFromMidi(new TextEncoder().encode("nope").buffer as ArrayBuffer)).toThrow(
      MidiImportError,
    )
    expect(() => importMidi(new Midi())).toThrow(MidiImportError)
  })
})
