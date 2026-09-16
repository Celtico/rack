import { describe, expect, it } from "vitest"

import { MAX_CHAIN } from "./patterns"
import {
  fitSections,
  grownLast,
  layOut,
  sectionAt,
  sectionSpans,
  STRUCTURES,
  withoutBar,
} from "./sections"

const s = (name: string, bars: number) => ({ name, bars })

describe("sections", () => {
  it("places sections on the chain and finds the one holding a bar", () => {
    const sections = [s("Intro", 4), s("Verse", 8)]
    expect(sectionSpans(sections)).toEqual([
      { name: "Intro", bars: 4, start: 0 },
      { name: "Verse", bars: 8, start: 4 },
    ])
    expect(sectionAt(sections, 0)).toBe(0)
    expect(sectionAt(sections, 3)).toBe(0)
    expect(sectionAt(sections, 4)).toBe(1)
    expect(sectionAt(sections, 11)).toBe(1)
    expect(sectionAt(sections, 12)).toBe(-1)
    expect(sectionAt(sections, -1)).toBe(-1)
  })

  it("fits sections to a chain: cut past its end, stretched over what they leave, dropped when empty", () => {
    expect(fitSections([s("A", 4), s("B", 8)], 6)).toEqual([s("A", 4), s("B", 2)])
    expect(fitSections([s("A", 4), s("B", 8)], 20)).toEqual([s("A", 4), s("B", 16)])
    expect(fitSections([s("A", 4), s("B", 0), s(" C ", 4.7)], 8)).toEqual([s("A", 4), s("C", 4)])
    expect(fitSections([s("A", 4)], 0)).toEqual([])
    expect(fitSections([], 8)).toEqual([])
    // A bar past every section's end and no section to stretch: a nameless one.
    expect(fitSections([s("A", 0)], 3)).toEqual([s("", 3)])
  })

  it("keeps in step with a bar taken out or bars appended", () => {
    const sections = [s("A", 1), s("B", 2)]
    expect(withoutBar(sections, 0)).toEqual([s("B", 2)])
    expect(withoutBar(sections, 2)).toEqual([s("A", 1), s("B", 1)])
    expect(withoutBar(sections, 9)).toEqual(sections)
    expect(grownLast(sections, 3)).toEqual([s("A", 1), s("B", 5)])
    expect(grownLast([], 3)).toEqual([])
  })

  it("lays a structure out on one pattern, within the chain's limit", () => {
    const pop = STRUCTURES[0]!
    const { chain, sections } = layOut(pop.sections, 2)
    expect(chain).toHaveLength(120)
    expect(chain.every((p) => p === 2)).toBe(true)
    expect(sections).toEqual(pop.sections)

    const huge = layOut([s("A", 200), s("B", 200)], 0)
    expect(huge.chain).toHaveLength(MAX_CHAIN)
    expect(huge.sections).toEqual([s("A", 200), s("B", MAX_CHAIN - 200)])
  })
})
