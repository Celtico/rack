import { beforeEach, describe, expect, it } from "vitest"

import { ensureOrder, moveWithin, useLayoutStore } from "./layout"

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

describe("ensureOrder", () => {
  it("keeps known ids in place, drops unknown ones and appends new ones", () => {
    expect(
      ensureOrder(
        ["SONG", "drums-1", "gone", "TRANSPORT"],
        ["TRANSPORT", "SONG", "drums-1", "drums-2"],
      ),
    ).toEqual(["SONG", "drums-1", "TRANSPORT", "drums-2"])
  })
})

describe("layout store", () => {
  const ORDER = ["TRANSPORT", "PATTERN", "SONG", "drums-1", "synth-1", "FX-2"]

  beforeEach(() => {
    useLayoutStore.setState({ order: [...ORDER], hidden: [] })
  })

  it("nudges a unit up and down within bounds", () => {
    const s = useLayoutStore.getState()
    s.nudgeUnit("drums-1", -1)
    expect(useLayoutStore.getState().order.slice(0, 4)).toEqual([
      "TRANSPORT",
      "PATTERN",
      "drums-1",
      "SONG",
    ])
    s.nudgeUnit("TRANSPORT", -1)
    expect(useLayoutStore.getState().order[0]).toBe("TRANSPORT")
  })

  it("hides and shows hideable fixed units, never the transport or an instance", () => {
    const s = useLayoutStore.getState()
    s.hideUnit("SONG")
    s.hideUnit("SONG")
    s.hideUnit("TRANSPORT")
    s.hideUnit("drums-1")
    expect(useLayoutStore.getState().hidden).toEqual(["SONG"])
    s.showUnit("SONG")
    expect(useLayoutStore.getState().hidden).toEqual([])
  })

  it("syncs the order with the units that exist, keeping the arrangement", () => {
    const s = useLayoutStore.getState()
    const before = useLayoutStore.getState().order
    s.syncUnits(ORDER)
    expect(useLayoutStore.getState().order).toBe(before)

    s.syncUnits(["TRANSPORT", "PATTERN", "SONG", "FX-2", "synth-1", "drums-2"])
    expect(useLayoutStore.getState().order).toEqual([
      "TRANSPORT",
      "PATTERN",
      "SONG",
      "synth-1",
      "FX-2",
      "drums-2",
    ])
  })
})
