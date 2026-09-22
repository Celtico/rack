import { fireEvent, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { TimelineUnit } from "./TimelineUnit"

const engine = {
  start: vi.fn().mockResolvedValue(undefined),
  playFrom: vi.fn(),
  stop: vi.fn(),
}

vi.mock("../audio/engine", () => ({
  getEngine: () => engine,
}))

describe("<TimelineUnit />", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRackStore.setState({
      chain: [0, 2],
      sections: [],
      activePattern: 1,
      playingBar: -1,
      currentStep: -1,
      playing: false,
      followSong: true,
      folded: {},
    })
  })

  it("runs the song from a bar's play button: starting the clock, or jumping while it runs", async () => {
    const user = userEvent.setup()
    useRackStore.setState({ followSong: false })
    renderWithChakra(<TimelineUnit />)

    await user.click(screen.getByRole("button", { name: "Play from bar 2" }))
    expect(engine.start).toHaveBeenCalledWith(1)
    expect(engine.playFrom).not.toHaveBeenCalled()
    expect(useRackStore.getState().playing).toBe(true)
    // A slot picked from the bank was looping: the song takes over again.
    expect(useRackStore.getState().followSong).toBe(true)
    // The bar's own click (cycling the pattern) did not fire.
    expect(useRackStore.getState().chain).toEqual([0, 2])

    await user.click(screen.getByRole("button", { name: "Play from bar 1" }))
    expect(engine.playFrom).toHaveBeenCalledWith(0)
    expect(engine.start).toHaveBeenCalledTimes(1)
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
        getData: (type: string) => (type === "application/x-rack-pattern" ? String(slot) : ""),
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

  it("moves a bar dragged onto another, or onto the +, keeping the sections' lengths", () => {
    useRackStore.setState({
      chain: [0, 1, 2, 3],
      sections: [
        { name: "A", bars: 2 },
        { name: "B", bars: 2 },
      ],
    })
    renderWithChakra(<TimelineUnit />)
    const drag = (from: HTMLElement, to: HTMLElement, bar: number) => {
      const dataTransfer = {
        types: ["application/x-rack-bar"],
        setData: () => {},
        getData: () => String(bar),
        effectAllowed: "none",
        dropEffect: "none",
      }
      fireEvent.dragStart(from, { dataTransfer })
      expect(from).toHaveAttribute("data-dragging")
      fireEvent.dragOver(to, { dataTransfer })
      expect(to).toHaveAttribute("data-drop-target")
      expect(dataTransfer.dropEffect).toBe("move")
      fireEvent.drop(to, { dataTransfer })
      fireEvent.dragEnd(from, { dataTransfer })
    }

    // Bar 1 onto bar 3: it lands after it.
    drag(
      screen.getByRole("listitem", { name: "Bar 1: pattern 1" }),
      screen.getByRole("listitem", { name: "Bar 3: pattern 3" }),
      0,
    )
    expect(useRackStore.getState().chain).toEqual([1, 2, 0, 3])
    expect(useRackStore.getState().sections).toEqual([
      { name: "A", bars: 2 },
      { name: "B", bars: 2 },
    ])
    // Bar 4 onto the +: to the end (it is there already), so nothing changes; bar 1 onto the +: last.
    drag(
      screen.getByRole("listitem", { name: "Bar 1: pattern 2" }),
      screen.getByRole("button", { name: "Add a bar of pattern 2" }),
      0,
    )
    expect(useRackStore.getState().chain).toEqual([2, 0, 3, 1])
    expect(screen.getByRole("listitem", { name: "Bar 4: pattern 2" })).not.toHaveAttribute(
      "data-dragging",
    )
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
