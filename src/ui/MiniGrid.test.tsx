import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { MiniGrid } from "./MiniGrid"

describe("<MiniGrid />", () => {
  beforeEach(() => {
    const instances = defaultInstances()
    useRackStore.setState({
      instances,
      patterns: createDefaultBank(instances),
      activePattern: 0,
      currentStep: -1,
    })
  })

  it("draws one cell per voice and step, lit where the pattern is on", () => {
    // Slot 2 starts empty; light one hat step in it.
    useRackStore.getState().setActivePattern(1)
    useRackStore.getState().toggleStep("drums-1", "hat", 2)
    renderWithChakra(<MiniGrid id="drums-1" label="DR-4" />)

    const grid = screen.getByRole("img", { name: "DR-4 pattern" })
    const cells = grid.querySelectorAll("span:not([data-step])")
    expect(cells).toHaveLength(4 * 16)
    expect(grid.querySelector("[data-step]")).toBeNull()
    expect(cells[0]).not.toHaveAttribute("data-on")
    // Hat is the fourth row; step 3 is the one lit.
    expect(cells[3 * 16 + 2]).toHaveAttribute("data-on")
    expect(cells[3 * 16 + 1]).not.toHaveAttribute("data-on")
  })

  it("marks the sounding column on every row, and stacks melodic rows highest first", () => {
    useRackStore.getState().setPlayhead(5, 0, 0)
    useRackStore.getState().toggleNote("synth-1", 0, 7) // C3, top row
    renderWithChakra(<MiniGrid id="synth-1" label="MONO-1" />)

    const grid = screen.getByRole("img", { name: "MONO-1 pattern" })
    const cells = grid.querySelectorAll("span:not([data-step])")
    expect(cells).toHaveLength(8 * 16)
    expect(cells[0]).toHaveAttribute("data-on")
    // One playhead bar over column 6: past one beat (16 + 4 px) and one cell (4 + 2 px).
    const playhead = grid.querySelector("[data-step]")
    expect(playhead).toHaveAttribute("data-step", "5")
    expect(playhead).toHaveStyle({ left: "32px" })
  })

  it("renders nothing for an instance that is not in the pattern", () => {
    const { container } = renderWithChakra(<MiniGrid id="drums-9" label="DR-4 #9" />)
    expect(container.querySelector("[role=img]")).toBeNull()
  })
})
