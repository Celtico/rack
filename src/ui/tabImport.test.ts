import { beforeEach, describe, expect, it, vi } from "vitest"

import { emptyHistory } from "../state/history"
import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
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

  it("does nothing with text that holds no tab", () => {
    expect(writeTab("strings-1", "just some words")).toBeNull()
    expect(engine.syncFromStore).not.toHaveBeenCalled()
  })
})
