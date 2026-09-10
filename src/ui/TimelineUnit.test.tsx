import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { TimelineUnit } from "./TimelineUnit"

describe("<TimelineUnit />", () => {
  beforeEach(() => {
    useRackStore.setState({ chain: [0, 2], activePattern: 1, playingBar: -1, currentStep: -1 })
  })

  it("lists one block per bar, coloured by pattern, and marks the sounding bar", () => {
    useRackStore.setState({ playingBar: 3, currentStep: 7 })
    renderWithChakra(<TimelineUnit />)

    const bars = within(screen.getByRole("list", { name: "Song bars" })).getAllByRole("listitem")
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveAttribute("data-pattern", "1")
    expect(bars[1]).toHaveAttribute("data-pattern", "3")
    // Bar 3 of a 2-bar chain wraps to the second block.
    expect(bars[1]).toHaveAttribute("data-playing")
    expect(bars[0]).not.toHaveAttribute("data-playing")
  })

  it("cycles a bar's pattern on click, removes with ×, appends the active pattern with +", async () => {
    const user = userEvent.setup()
    renderWithChakra(<TimelineUnit />)

    await user.click(screen.getByRole("listitem", { name: "Bar 2: pattern 3" }))
    expect(useRackStore.getState().chain).toEqual([0, 3])

    await user.click(screen.getByRole("button", { name: "Add a bar of pattern 2" }))
    expect(useRackStore.getState().chain).toEqual([0, 3, 1])

    await user.click(screen.getByRole("button", { name: "Remove bar 1" }))
    expect(useRackStore.getState().chain).toEqual([3, 1])

    await user.click(screen.getByRole("button", { name: "Clear song" }))
    expect(useRackStore.getState().chain).toEqual([])
    expect(screen.getByText(/looping pattern 2/i)).toBeInTheDocument()
  })
})
