import { beforeEach, describe, expect, it } from "vitest"

import { moveWithin, UNIT_IDS, useLayoutStore } from "./layout"

describe("moveWithin", () => {
  const order = ["a", "b", "c", "d"] as const

  it("drops an item after the target when dragging down, before it when dragging up", () => {
    expect(moveWithin(order, "a", "c")).toEqual(["b", "c", "a", "d"])
    expect(moveWithin(order, "d", "b")).toEqual(["a", "d", "b", "c"])
  })

  it("leaves the order alone for a no-op or unknown ids", () => {
    expect(moveWithin(order, "b", "b")).toEqual([...order])
    expect(moveWithin(order, "zz" as never, "b")).toEqual([...order])
  })
})

describe("layout store", () => {
  beforeEach(() => {
    useLayoutStore.setState({ order: [...UNIT_IDS], hidden: [] })
  })

  it("nudges a unit up and down within bounds", () => {
    const s = useLayoutStore.getState()
    s.nudgeUnit("DR-4", -1)
    expect(useLayoutStore.getState().order.slice(0, 4)).toEqual([
      "TRANSPORT",
      "PATTERN",
      "DR-4",
      "SONG",
    ])
    s.nudgeUnit("TRANSPORT", -1)
    expect(useLayoutStore.getState().order[0]).toBe("TRANSPORT")
  })

  it("hides and shows units, never the transport", () => {
    const s = useLayoutStore.getState()
    s.hideUnit("EP-1")
    s.hideUnit("EP-1")
    s.hideUnit("TRANSPORT")
    expect(useLayoutStore.getState().hidden).toEqual(["EP-1"])
    s.showUnit("EP-1")
    expect(useLayoutStore.getState().hidden).toEqual([])
  })
})
