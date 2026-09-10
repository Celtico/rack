import { describe, expect, it } from "vitest"

import { createEmptyPattern, toggleDrumStep } from "./pattern"
import { createDefaultBank, resolvePlayingPattern } from "./patterns"

const bank = [0, 1, 2, 3].map((i) => toggleDrumStep(createEmptyPattern(), "kick", i))

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
  it("has four slots with the groove in the first", () => {
    const b = createDefaultBank()
    expect(b).toHaveLength(4)
    expect(b[0]!.drums.kick[0]).toBe(true)
    expect(b[1]!.drums.kick.some(Boolean)).toBe(false)
  })
})
