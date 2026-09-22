import { describe, expect, it } from "vitest"

import { defaultInstances } from "./instances"
import { createEmptyPattern, rowsOf, toggleKitStep, withTrack, type KitTrack } from "./pattern"
import { createDefaultBank, movedBar, PATTERN_COUNT, resolvePlayingPattern } from "./patterns"

describe("movedBar", () => {
  it("lands after a later bar and before an earlier one, and ignores nonsense", () => {
    expect(movedBar([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3])
    expect(movedBar([0, 1, 2, 3], 3, 1)).toEqual([0, 3, 1, 2])
    expect(movedBar([0, 1, 2, 3], 1, 1)).toEqual([0, 1, 2, 3])
    expect(movedBar([0, 1, 2, 3], 5, 1)).toEqual([0, 1, 2, 3])
    expect(movedBar([0, 1, 2, 3], 1, -1)).toEqual([0, 1, 2, 3])
  })
})

const OWNERS = [{ id: "drums-1", kind: "drums" as const }]

const bank = [0, 1, 2, 3].map((i) => {
  const p = createEmptyPattern(OWNERS)
  return withTrack(p, "drums-1", toggleKitStep(p.tracks["drums-1"] as KitTrack, "kick", i))
})

describe("resolvePlayingPattern", () => {
  it("loops the active pattern when there is no chain", () => {
    for (const bar of [0, 1, 7]) {
      const r = resolvePlayingPattern(bank, 2, [], bar)
      expect(r.index).toBe(2)
      expect(r.pattern).toBe(bank[2])
    }
  })

  it("walks the chain one slot per bar and wraps", () => {
    const chain = [0, 0, 1, 3]
    expect(resolvePlayingPattern(bank, 2, chain, 0).index).toBe(0)
    expect(resolvePlayingPattern(bank, 2, chain, 1).index).toBe(0)
    expect(resolvePlayingPattern(bank, 2, chain, 2).index).toBe(1)
    expect(resolvePlayingPattern(bank, 2, chain, 3).index).toBe(3)
    expect(resolvePlayingPattern(bank, 2, chain, 4).index).toBe(0)
    expect(resolvePlayingPattern(bank, 2, chain, 6).pattern).toBe(bank[1])
  })

  it("falls back to slot 1 for an index outside the bank", () => {
    const r = resolvePlayingPattern(bank, 9, [], 0)
    expect(r.pattern).toBe(bank[0])
  })
})

describe("createDefaultBank", () => {
  it("has PATTERN_COUNT slots with the groove in the first, for every default instance", () => {
    const instances = defaultInstances()
    const b = createDefaultBank(instances)
    expect(b).toHaveLength(PATTERN_COUNT)
    const first = b[0]!.tracks["drums-1"] as KitTrack
    const second = b[1]!.tracks["drums-1"] as KitTrack
    expect(rowsOf(first).kick![0]).toBe(true)
    expect(rowsOf(second).kick!.some(Boolean)).toBe(false)
    for (const p of b) expect(Object.keys(p.tracks)).toEqual(instances.map((i) => i.id))
  })
})
