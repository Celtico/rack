import { fireEvent, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { TimelineUnit } from "./TimelineUnit"

describe("<TimelineUnit />", () => {
  beforeEach(() => {
    useRackStore.setState({
      chain: [0, 2],
      sections: [],
      activePattern: 1,
      playingBar: -1,
      currentStep: -1,
      folded: {},
    })
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

    await user.click(screen.getByRole("button", { name: "Repeat the last bar" }))
    expect(useRackStore.getState().chain).toEqual([3, 1, 1])
    await user.click(screen.getByRole("button", { name: "Repeat the whole song once more" }))
    expect(useRackStore.getState().chain).toEqual([3, 1, 1, 3, 1, 1])

    await user.click(screen.getByRole("button", { name: "Clear song" }))
    expect(useRackStore.getState().chain).toEqual([])
    expect(screen.getByText(/looping pattern 2/i)).toBeInTheDocument()
  })

  it("groups the bars under their sections, adds one from the row and renames it in place", async () => {
    const user = userEvent.setup()
    renderWithChakra(<TimelineUnit />)

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Length of the new section" }),
      "4",
    )
    // An input with a datalist is a combobox to ARIA.
    await user.type(screen.getByRole("combobox", { name: "Name of the new section" }), "Chorus")
    await user.click(screen.getByRole("button", { name: "Add a section of 4 bars of pattern 2" }))
    expect(useRackStore.getState().chain).toEqual([0, 2, 1, 1, 1, 1])
    expect(useRackStore.getState().sections).toEqual([
      { name: "Part 1", bars: 2 },
      { name: "Chorus", bars: 4 },
    ])
    expect(
      within(screen.getByRole("list", { name: "Part 1 bars" })).getAllByRole("listitem"),
    ).toHaveLength(2)
    expect(
      within(screen.getByRole("list", { name: "Chorus bars" })).getAllByRole("listitem"),
    ).toHaveLength(4)

    await user.click(screen.getByRole("button", { name: "Rename section Part 1" }))
    const field = screen.getByRole("combobox", { name: "New name for section Part 1" })
    await user.clear(field)
    await user.type(field, "Intro{Enter}")
    expect(useRackStore.getState().sections[0]).toEqual({ name: "Intro", bars: 2 })

    await user.selectOptions(screen.getByRole("combobox", { name: "Length of Chorus" }), "8")
    expect(useRackStore.getState().chain).toHaveLength(10)
    expect(useRackStore.getState().sections[1]).toEqual({ name: "Chorus", bars: 8 })
  })

  it("takes a bank slot dropped on a bar, on the + and on a section's name", () => {
    useRackStore.setState({ sections: [{ name: "Intro", bars: 2 }] })
    renderWithChakra(<TimelineUnit />)
    const drop = (el: HTMLElement, slot: number) => {
      const dataTransfer = {
        types: ["application/x-rack-pattern"],
        getData: () => String(slot),
        dropEffect: "none",
      }
      fireEvent.dragOver(el, { dataTransfer })
      expect(el).toHaveAttribute("data-drop-target")
      fireEvent.drop(el, { dataTransfer })
      expect(el).not.toHaveAttribute("data-drop-target")
    }

    drop(screen.getByRole("listitem", { name: "Bar 2: pattern 3" }), 5)
    expect(useRackStore.getState().chain).toEqual([0, 5])
    drop(screen.getByRole("button", { name: "Add a bar of pattern 2" }), 7)
    expect(useRackStore.getState().chain).toEqual([0, 5, 7])
    drop(screen.getByRole("button", { name: "Rename section Intro" }), 9)
    expect(useRackStore.getState().chain).toEqual([9, 9, 9])
  })

  it("sets a focused bar's pattern from the digits typed on it", async () => {
    const user = userEvent.setup()
    renderWithChakra(<TimelineUnit />)

    const bar = screen.getByRole("listitem", { name: "Bar 1: pattern 1" })
    bar.focus()
    await user.keyboard("5")
    expect(useRackStore.getState().chain).toEqual([4, 2])

    // Two quick digits make a two-digit number; the bar keeps focus through the re-render.
    await user.keyboard("1")
    expect(useRackStore.getState().chain).toEqual([0, 2])
    await user.keyboard("2")
    expect(useRackStore.getState().chain).toEqual([11, 2])

    // A letter does nothing.
    await user.keyboard("x")
    expect(useRackStore.getState().chain).toEqual([11, 2])
  })
})
