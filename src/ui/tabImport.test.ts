import { beforeEach, describe, expect, it, vi } from "vitest"

import { emptyHistory } from "../state/history"
import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { rowNotes } from "../state/pattern"
import { useRackStore } from "../state/store"
import { writeTab } from "./tabImport"

const engine = { syncFromStore: vi.fn() }
vi.mock("../audio/engine", () => ({ getEngine: () => engine }))

const ARPEGGIO = `
E|---0---0----0---0----0---0---0---0--------|
B|-----0--------0--------0-------0----------|
G|-2--------2--------2-------2--------------|
D|------------------------------------------|
A|------------------------------------------|
E|------------------------------------------|
`

describe("writeTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const instances = defaultInstances().filter((i) => i.kind !== "strings")
    useRackStore.setState({
      instances,
      patterns: createDefaultBank(instances),
      activePattern: 2,
      chain: [],
      sections: [],
      history: emptyHistory(),
      stroke: null,
    })
    useRackStore.getState().addInstance("strings")
  })

  it("sets the key that holds the tab's notes and writes a step per column into the slot on screen", () => {
    const result = writeTab("strings-1", ARPEGGIO)
    expect(result?.slots).toEqual([2])
    expect(result?.choice.dropped).toBe(0)
    const s = useRackStore.getState()
    expect(s.instances.find((i) => i.id === "strings-1")?.key).toEqual(result?.choice.key)
    const track = s.patterns[2]!.tracks["strings-1"]
    expect(track && "chords" in track && track.chords.every((c) => c.length === 1)).toBe(true)
    expect(s.chain).toEqual([])
    expect(engine.syncFromStore).toHaveBeenCalled()
  })

  it("spreads a long tab over the following slots and chains them", () => {
    const text = [ARPEGGIO, ARPEGGIO, ARPEGGIO].join("\n")
    const result = writeTab("strings-1", text)
    expect(result?.columns).toHaveLength(48)
    expect(result?.slots).toEqual([2, 3, 4])
    expect(useRackStore.getState().chain).toEqual([2, 3, 4])
  })

  it("writes a melody into a MONO-1 one note a step, the top note of a chord", () => {
    useRackStore.getState().addInstance("synth")
    const text = `e|--3--0--|\nB|-----0--|\nG|--------|\nD|--------|\nA|--------|\nE|--------|`
    const result = writeTab("synth-1", text)
    expect(result?.slots).toEqual([2])
    const track = useRackStore.getState().patterns[2]!.tracks["synth-1"]
    expect(track?.kind).toBe("synth")
    if (track?.kind !== "synth") return
    const struck = track.notes.filter((n): n is number => n !== null)
    expect(struck).toHaveLength(2)
    // The second column holds E4 and B3 together: the melody takes E4, the higher note.
    const key = useRackStore.getState().instances.find((i) => i.id === "synth-1")!.key!
    expect(key).toEqual(result?.choice.key)
    const rows = rowNotes("synth", key)
    expect(rows[struck[0]!]).toBe("G4")
    expect(rows[struck[1]!]).toBe("E4")
  })

  it("refuses a kit", () => {
    expect(writeTab("drums-1", ARPEGGIO)).toBeNull()
  })

  it("does nothing with text that holds no tab", () => {
    expect(writeTab("strings-1", "just some words")).toBeNull()
    expect(engine.syncFromStore).not.toHaveBeenCalled()
  })
})
