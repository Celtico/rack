import { describe, expect, it } from "vitest"

import {
  bassEventAt,
  createEmptyPattern,
  emptyTrack,
  isMutedIn,
  hitsAt,
  isPatternEmpty,
  isTrackEmpty,
  polyNotesAt,
  rowsOf,
  synthNoteAt,
  toggleBassFlag,
  toggleKitStep,
  toggleTrackNote,
  togglePartMute,
  withoutTrack,
  withTrack,
  type KitTrack,
  type PolyTrack,
  type Track,
} from "./pattern"

const bass = (t: Track) => (t.kind === "bass" ? t.bass : null)!
const notes = (t: Track) => (t.kind === "synth" ? t.notes : null)!
const chords = (t: Track) => (t as PolyTrack).chords

describe("kit tracks", () => {
  it("flips one step of one voice without touching other rows or mutating the input", () => {
    const before = emptyTrack("perc") as KitTrack
    const after = toggleKitStep(before, "cowbell", 6)
    expect(rowsOf(after).cowbell![6]).toBe(true)
    expect(rowsOf(before).cowbell![6]).toBe(false)
    expect(rowsOf(after).shaker).toBe(rowsOf(before).shaker)
    expect(rowsOf(toggleKitStep(after, "cowbell", 6)).cowbell![6]).toBe(false)
  })

  it("ignores voices the kit does not have", () => {
    const track = emptyTrack("drums") as KitTrack
    expect(toggleKitStep(track, "cowbell", 0)).toBe(track)
  })

  it("lists the voices on at a step in voice order", () => {
    let t = emptyTrack("drums") as KitTrack
    t = toggleKitStep(t, "hat", 0)
    t = toggleKitStep(t, "kick", 0)
    t = toggleKitStep(t, "snare", 4)
    expect(hitsAt(t, 0)).toEqual(["kick", "hat"])
    expect(hitsAt(t, 4)).toEqual(["snare"])
    expect(hitsAt(t, 1)).toEqual([])
  })
})

describe("MONO-1 track", () => {
  it("keeps at most one note per column and clears it when set again", () => {
    let t = emptyTrack("synth")
    t = toggleTrackNote(t, 4, 2)
    expect(notes(t)[4]).toBe(2)
    t = toggleTrackNote(t, 4, 6)
    expect(notes(t)[4]).toBe(6)
    expect(notes(t).filter((r) => r !== null)).toHaveLength(1)
    t = toggleTrackNote(t, 4, 6)
    expect(notes(t)[4]).toBeNull()
  })

  it("never mutates the input", () => {
    const before = emptyTrack("synth")
    const after = toggleTrackNote(before, 1, 1)
    expect(after).not.toBe(before)
    expect(notes(before)[1]).toBeNull()
    expect(notes(after)[1]).toBe(1)
  })

  it("maps row indices to note names and rests to null", () => {
    let t = emptyTrack("synth")
    t = toggleTrackNote(t, 2, 0)
    t = toggleTrackNote(t, 3, 7)
    expect(synthNoteAt(notes(t), 2)).toBe("C2")
    expect(synthNoteAt(notes(t), 3)).toBe("C3")
    expect(synthNoteAt(notes(t), 4)).toBeNull()
  })
})

describe("BASS-2 track", () => {
  it("keeps one note per column and flips flags independently", () => {
    let t = emptyTrack("bass")
    t = toggleTrackNote(t, 2, 1)
    t = toggleTrackNote(t, 2, 6)
    t = toggleBassFlag(t, 2, "slide")
    expect(bass(t).notes[2]).toBe(6)
    expect(bass(t).slide[2]).toBe(true)
    expect(bass(t).accent[2]).toBe(false)
    expect(bassEventAt(bass(t), 2)).toEqual({ note: "G2", accent: false, slide: true })
    expect(bassEventAt(bass(t), 3)).toEqual({ note: null, accent: false, slide: false })

    t = toggleTrackNote(t, 2, 6)
    expect(bass(t).notes[2]).toBeNull()
    // Flags survive clearing the note, so a rest can still be marked.
    expect(bass(t).slide[2]).toBe(true)
  })

  it("leaves other kinds alone when asked for a flag", () => {
    const t = emptyTrack("drums")
    expect(toggleBassFlag(t, 0, "accent")).toBe(t)
  })
})

describe("polyphonic tracks", () => {
  it("adds and removes notes of a chord, keeping the column sorted", () => {
    let t = emptyTrack("ep")
    t = toggleTrackNote(t, 4, 5)
    t = toggleTrackNote(t, 4, 1)
    t = toggleTrackNote(t, 4, 3)
    expect(chords(t)[4]).toEqual([1, 3, 5])
    expect(polyNotesAt(t as PolyTrack, 4)).toEqual(["E3", "B3", "E4"])
    expect(polyNotesAt(t as PolyTrack, 5)).toEqual([])

    const before = t
    t = toggleTrackNote(t, 4, 3)
    expect(chords(t)[4]).toEqual([1, 5])
    expect(chords(before)[4]).toEqual([1, 3, 5])
    expect(chords(t)[0]).toBe(chords(before)[0])
  })

  it("uses each kind's own note names", () => {
    const strings = toggleTrackNote(emptyTrack("strings"), 0, 7) as PolyTrack
    const poly = toggleTrackNote(emptyTrack("poly"), 0, 0) as PolyTrack
    expect(polyNotesAt(strings, 0)).toEqual(["B3"])
    expect(polyNotesAt(poly, 0)).toEqual(["C3"])
  })
})

describe("patterns", () => {
  const owners = [
    { id: "drums-1", kind: "drums" as const },
    { id: "drums-2", kind: "drums" as const },
    { id: "bass-1", kind: "bass" as const },
  ]

  it("holds one empty track per instance, keyed by id", () => {
    const p = createEmptyPattern(owners)
    expect(Object.keys(p.tracks)).toEqual(["drums-1", "drums-2", "bass-1"])
    expect(p.tracks["drums-2"]!.kind).toBe("drums")
    expect(p.tracks["bass-1"]!.kind).toBe("bass")
  })

  it("knows an empty pattern from one with a single hit or note", () => {
    const p = createEmptyPattern(owners)
    expect(isPatternEmpty(p)).toBe(true)
    const withKick = withTrack(
      p,
      "drums-2",
      toggleKitStep(p.tracks["drums-2"] as KitTrack, "kick", 3),
    )
    expect(isPatternEmpty(withKick)).toBe(false)
    const withBass = withTrack(p, "bass-1", toggleTrackNote(p.tracks["bass-1"]!, 0, 2))
    expect(isPatternEmpty(withBass)).toBe(false)
    expect(isTrackEmpty(emptyTrack("poly"))).toBe(true)
    expect(isTrackEmpty(toggleTrackNote(emptyTrack("poly"), 5, 1))).toBe(false)
  })

  it("replaces and removes tracks without mutating", () => {
    const p = createEmptyPattern(owners)
    const kicked = toggleKitStep(p.tracks["drums-2"] as KitTrack, "kick", 0)
    const q = withTrack(p, "drums-2", kicked)
    expect(q).not.toBe(p)
    expect(q.tracks["drums-2"]).toBe(kicked)
    expect(q.tracks["drums-1"]).toBe(p.tracks["drums-1"])
    expect(hitsAt(p.tracks["drums-2"] as KitTrack, 0)).toEqual([])

    const r = withoutTrack(q, "drums-1")
    expect(Object.keys(r.tracks)).toEqual(["drums-2", "bass-1"])
    expect(Object.keys(q.tracks)).toHaveLength(3)
  })

  it("lets a part sit a slot out, keeps that through track edits, and drops it with the instance", () => {
    const p = createEmptyPattern([
      { id: "drums-1", kind: "drums" },
      { id: "synth-1", kind: "synth" },
    ])
    expect(isMutedIn(p, "drums-1")).toBe(false)
    const out = togglePartMute(p, "drums-1")
    expect(isMutedIn(out, "drums-1")).toBe(true)
    expect(p.muted).toBeUndefined()
    const edited = withTrack(out, "synth-1", emptyTrack("synth"))
    expect(isMutedIn(edited, "drums-1")).toBe(true)
    expect(togglePartMute(out, "drums-1").muted).toBeUndefined()
    expect(withoutTrack(out, "drums-1").muted).toBeUndefined()
    expect(withoutTrack(togglePartMute(out, "synth-1"), "drums-1").muted).toEqual(["synth-1"])
  })

  it("gives a video loop a gate that starts open everywhere, and counts that as empty", () => {
    const track = emptyTrack("video")
    expect(track.kind).toBe("video")
    const gate = "rows" in track ? (track.rows as Record<string, readonly boolean[]>).gate! : []
    expect(gate).toHaveLength(16)
    expect(gate.every(Boolean)).toBe(true)
    expect(isTrackEmpty(track)).toBe(true)
  })
})
