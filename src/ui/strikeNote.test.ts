import { beforeEach, describe, expect, it, vi } from "vitest"

import { emptyHistory } from "../state/history"
import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { useRackStore } from "../state/store"
import { rowNotes } from "../state/pattern"
import { midiOfName } from "../state/tab"
import { appendNote, applyAppend, nextFreeStep, planAppend } from "./strikeNote"

vi.mock("../audio/engine", () => ({
  getEngine: () => ({ playNotes: vi.fn(), syncFromStore: vi.fn() }),
}))

const chordsAt = (step: number) => {
  const track = useRackStore.getState().patterns[0]!.tracks["strings-1"]
  return track && "chords" in track ? track.chords[step] : undefined
}

describe("nextFreeStep / appendNote", () => {
  beforeEach(() => {
    const instances = defaultInstances().filter((i) => i.kind !== "strings")
    useRackStore.setState({
      instances,
      patterns: createDefaultBank(instances),
      activePattern: 0,
      history: emptyHistory(),
      stroke: null,
    })
    useRackStore.getState().addInstance("strings")
  })

  it("finds the step after the last one holding anything, and none once the bar is used up", () => {
    const empty = Array.from({ length: 16 }, () => [] as number[])
    expect(nextFreeStep(empty)).toBe(0)
    expect(nextFreeStep(empty.map((c, i) => (i === 4 ? [2] : c)))).toBe(5)
    expect(nextFreeStep(empty.map((c, i) => (i === 15 ? [0] : c)))).toBeNull()
  })

  it("appends notes one step at a time and stops at the end of the bar", () => {
    expect(appendNote("strings-1", 3)).toBe(0)
    expect(appendNote("strings-1", 2)).toBe(1)
    expect(chordsAt(0)).toEqual([3])
    expect(chordsAt(1)).toEqual([2])
    for (let i = 2; i < 16; i++) appendNote("strings-1", 0)
    expect(appendNote("strings-1", 0)).toBeNull()
    expect(appendNote("drums-1", 0)).toBeNull()
  })
})

describe("planAppend / applyAppend", () => {
  beforeEach(() => {
    const instances = defaultInstances().filter((i) => i.kind !== "strings")
    useRackStore.setState({
      instances,
      patterns: createDefaultBank(instances),
      activePattern: 0,
      history: emptyHistory(),
      stroke: null,
    })
    useRackStore.getState().addInstance("strings")
    // G major at octave 2: G2 A2 B2 C3 D3 E3 F#3 G3.
    useRackStore.getState().setInstanceKey("strings-1", { root: 7, scale: "major", octave: 2 })
  })

  it("plans a note the key holds at the next free step, with no key change", () => {
    expect(planAppend("strings-1", 47)).toEqual({ step: 0, row: 2 }) // B2
  })

  it("changes the key for a note the key lacks, keeping every pitch already written", () => {
    // C3 (row 3) and G3 (row 7) are in; E4 (64) is above the rows.
    applyAppend("strings-1", planAppend("strings-1", 48)!)
    applyAppend("strings-1", planAppend("strings-1", 55)!)
    const plan = planAppend("strings-1", 64)
    expect(plan?.step).toBe(2)
    expect(plan?.key).toBeDefined()
    applyAppend("strings-1", plan!)
    const s = useRackStore.getState()
    const key = s.instances.find((i) => i.id === "strings-1")!.key!
    const rows = rowNotes("strings", key).map(midiOfName)
    // The three notes sound as they did: C3, G3, then E4, each on the new key's row for it.
    expect(chordsAt(0)!.map((r) => rows[r])).toEqual([48])
    expect(chordsAt(1)!.map((r) => rows[r])).toEqual([55])
    expect(chordsAt(2)!.map((r) => rows[r])).toEqual([64])
  })

  it("has no plan when no eight-row key holds the note with the others", () => {
    applyAppend("strings-1", planAppend("strings-1", 40)!) // E2, the low E open
    applyAppend("strings-1", planAppend("strings-1", 43)!) // G2
    expect(planAppend("strings-1", 76)).toBeNull() // E5: three octaves up, no key spans that
  })
})
