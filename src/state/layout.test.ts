import { beforeEach, describe, expect, it } from "vitest"

import {
  ensureOrder,
  HIDEABLE_UNITS,
  moveWithin,
  PANEL_WIDTH_DEFAULT,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  useLayoutStore,
} from "./layout"

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
        ["synth-1", "drums-1", "gone", "FX-2"],
        ["FX-2", "synth-1", "drums-1", "drums-2"],
      ),
    ).toEqual(["synth-1", "drums-1", "FX-2", "drums-2"])
  })
})

describe("layout store", () => {
  const ORDER = ["FX-2", "drums-1", "synth-1", "bass-1"]

  beforeEach(() => {
    useLayoutStore.setState({ order: [...ORDER], hidden: [] })
  })

  it("places a unit right after another, or at the end when that one is unknown", () => {
    const s = useLayoutStore.getState()
    s.placeAfter("drums-2", "drums-1")
    expect(useLayoutStore.getState().order).toEqual([
      "FX-2",
      "drums-1",
      "drums-2",
      "synth-1",
      "bass-1",
    ])
    s.placeAfter("bass-1", "FX-2")
    expect(useLayoutStore.getState().order).toEqual([
      "FX-2",
      "bass-1",
      "drums-1",
      "drums-2",
      "synth-1",
    ])
    s.placeAfter("perc-1", "nowhere")
    expect(useLayoutStore.getState().order.at(-1)).toBe("perc-1")
  })

  it("nudges a unit up and down within bounds", () => {
    const s = useLayoutStore.getState()
    s.nudgeUnit("synth-1", -1)
    expect(useLayoutStore.getState().order).toEqual(["FX-2", "synth-1", "drums-1", "bass-1"])
    s.nudgeUnit("FX-2", -1)
    expect(useLayoutStore.getState().order[0]).toBe("FX-2")
    s.nudgeUnit("bass-1", 1)
    expect(useLayoutStore.getState().order.at(-1)).toBe("bass-1")
  })

  it("swaps the pinned panels among themselves, never into the stack", () => {
    useLayoutStore.setState({ pinnedOrder: ["PATTERN", "SONG"] })
    const s = useLayoutStore.getState()
    s.nudgeUnit("SONG", -1)
    expect(useLayoutStore.getState().pinnedOrder).toEqual(["SONG", "PATTERN"])
    s.nudgeUnit("SONG", -1)
    expect(useLayoutStore.getState().pinnedOrder).toEqual(["SONG", "PATTERN"])
    s.moveUnit("PATTERN", "SONG")
    expect(useLayoutStore.getState().pinnedOrder).toEqual(["PATTERN", "SONG"])
    s.moveUnit("SONG", "drums-1")
    expect(useLayoutStore.getState().pinnedOrder).toEqual(["PATTERN", "SONG"])
    expect(useLayoutStore.getState().order).toEqual(ORDER)
  })

  it("hides and shows the transport, FX-2, BANK and SONG, never an instance", () => {
    const s = useLayoutStore.getState()
    s.hideUnit("FX-2")
    s.hideUnit("FX-2")
    s.hideUnit("drums-1")
    s.hideUnit("SONG")
    s.hideUnit("CLOCK")
    expect(useLayoutStore.getState().hidden).toEqual(["FX-2", "SONG", "CLOCK"])
    s.showUnit("FX-2")
    s.showUnit("SONG")
    s.showUnit("CLOCK")
    expect(useLayoutStore.getState().hidden).toEqual([])
    s.hideUnit("FX-2")
    s.hideUnit("CLOCK")
    s.showAll()
    expect(useLayoutStore.getState().hidden).toEqual([])
  })

  it("starts a fresh browser with every panel showing, and hydration leaves the defaults alone", async () => {
    expect(HIDEABLE_UNITS).toContain("CLOCK")
    expect(useLayoutStore.getInitialState().hidden).toEqual([])
    // Nothing stored: the defaults stand, whatever they are, rather than being rebuilt from nothing.
    localStorage.removeItem("rack-layout")
    useLayoutStore.setState({ ...useLayoutStore.getInitialState(), hidden: ["FX-2"] })
    await useLayoutStore.persist.rehydrate()
    expect(useLayoutStore.getState().hidden).toEqual(["FX-2"])
  })

  it("keeps the docked panel's width within its bounds", () => {
    const s = useLayoutStore.getState()
    s.setPanelWidth(600.4)
    expect(useLayoutStore.getState().panelWidth).toBe(600)
    s.setPanelWidth(10)
    expect(useLayoutStore.getState().panelWidth).toBe(PANEL_WIDTH_MIN)
    s.setPanelWidth(5000)
    expect(useLayoutStore.getState().panelWidth).toBe(PANEL_WIDTH_MAX)
    s.setPanelWidth(Number.NaN)
    expect(useLayoutStore.getState().panelWidth).toBe(PANEL_WIDTH_DEFAULT)
  })

  it("syncs the order with the units that exist, keeping the arrangement", () => {
    const s = useLayoutStore.getState()
    const before = useLayoutStore.getState().order
    s.syncUnits(ORDER)
    expect(useLayoutStore.getState().order).toBe(before)

    s.syncUnits(["FX-2", "synth-1", "drums-2"])
    expect(useLayoutStore.getState().order).toEqual(["FX-2", "synth-1", "drums-2"])
  })
})
