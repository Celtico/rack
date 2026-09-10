import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithChakra } from "../test/render"
import { LevelMeter } from "./LevelMeter"
import { litSegments } from "./meterScale"

vi.mock("../audio/engine", () => ({
  getEngine: () => ({ getLevels: () => ({ master: 0.55, drums: 0 }) }),
}))

describe("litSegments", () => {
  it("lights one segment per 6 dB, all eight at full scale, none in silence", () => {
    expect(litSegments(0)).toBe(0)
    expect(litSegments(1)).toBe(8)
    expect(litSegments(0.55)).toBe(7) // −5.2 dB, above the −6 dB segment
    expect(litSegments(0.5)).toBe(6) // −6.02 dB, just under it
    expect(litSegments(0.1)).toBe(4) // −20 dB
    expect(litSegments(0.001)).toBe(0) // −60 dB
  })
})

describe("<LevelMeter />", () => {
  it("renders eight segments and exposes the lit count as a meter", async () => {
    renderWithChakra(<LevelMeter source="master" label="Master level" />)
    const meter = screen.getByRole("meter", { name: "Master level" })
    expect(meter.querySelectorAll("span")).toHaveLength(8)
    // The first animation frame lights it up from the mocked engine.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(meter).toHaveAttribute("aria-valuenow", "7")
    expect(meter.querySelectorAll("[data-lit]")).toHaveLength(7)
  })
})
