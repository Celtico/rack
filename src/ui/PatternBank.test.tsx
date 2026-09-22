import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { emptyHistory } from "../state/history"
import { defaultInstances } from "../state/instances"
import { isPatternEmpty, isTrackEmpty } from "../state/pattern"
import { createDefaultBank } from "../state/patterns"
import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { PatternBank } from "./PatternBank"

const transfer = (type: string, data: string) => ({
  types: [type],
  getData: (t: string) => (t === type ? data : ""),
  dropEffect: "none",
})

describe("<PatternBank />", () => {
  beforeEach(() => {
    const instances = defaultInstances()
    useRackStore.setState({
      instances,
      patterns: createDefaultBank(instances),
      activePattern: 0,
      playingPattern: -1,
      chain: [],
      folded: {},
      solo: {},
      history: emptyHistory(),
      stroke: null,
    })
    useRackStore.getState().toggleStep("drums-1", "hat", 3)
  })

  // ⌥ swapping is not covered: jsdom has no DragEvent, so `altKey` never reaches the handler.
  it("copies a slot dragged onto another, leaving the source as it is", () => {
    renderWithChakra(<PatternBank />)
    const before = useRackStore.getState().patterns
    const slot2 = screen.getByRole("button", { name: "Edit pattern 2" })

    const dt = transfer("application/x-rack-pattern", "0")
    fireEvent.dragOver(slot2, { dataTransfer: dt })
    expect(dt.dropEffect).toBe("copy")
    expect(slot2).toHaveAttribute("data-drop-target")
    fireEvent.drop(slot2, { dataTransfer: dt })
    const s = useRackStore.getState()
    expect(s.patterns[0]).toBe(before[0])
    expect(s.patterns[1]).toEqual(before[0])
    expect(s.patterns[2]).toBe(before[2])
  })

  it("asks before emptying a slot dropped on the bank's surface, and empties it on Empty", async () => {
    const user = userEvent.setup()
    renderWithChakra(<PatternBank />)
    const surface = screen.getByText(/who plays in each pattern/i)
    expect(isPatternEmpty(useRackStore.getState().patterns[0]!)).toBe(false)

    fireEvent.dragOver(surface, { dataTransfer: transfer("application/x-rack-pattern", "0") })
    fireEvent.drop(surface, { dataTransfer: transfer("application/x-rack-pattern", "0") })
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(/empty pattern 1\?/i)

    // Cancel: nothing happens.
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(isPatternEmpty(useRackStore.getState().patterns[0]!)).toBe(false)

    // Empty: every part of the slot goes, as one undo step.
    fireEvent.drop(surface, { dataTransfer: transfer("application/x-rack-pattern", "0") })
    await screen.findByRole("alertdialog")
    await user.click(screen.getByRole("button", { name: "Empty" }))
    await waitFor(() => expect(isPatternEmpty(useRackStore.getState().patterns[0]!)).toBe(true))
    useRackStore.getState().undo()
    expect(isPatternEmpty(useRackStore.getState().patterns[0]!)).toBe(false)
  })

  it("empties just the dropped part, in its own pattern, when it lands on the surface", async () => {
    const user = userEvent.setup()
    useRackStore.getState().setActivePattern(3)
    useRackStore.getState().toggleStep("drums-1", "kick", 0)
    renderWithChakra(<PatternBank />)
    const surface = screen.getByText(/who plays in each pattern/i)
    fireEvent.drop(surface, { dataTransfer: transfer("application/x-rack-part", "drums-1:0") })
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(/DR-4's part in pattern 1\?/)
    await user.click(screen.getByRole("button", { name: "Empty" }))
    await waitFor(() =>
      expect(isTrackEmpty(useRackStore.getState().patterns[0]!.tracks["drums-1"]!)).toBe(true),
    )
    // The same machine's parts in the other patterns, and the other machines', are untouched.
    expect(isTrackEmpty(useRackStore.getState().patterns[3]!.tracks["drums-1"]!)).toBe(false)
    expect(isTrackEmpty(useRackStore.getState().patterns[0]!.tracks["synth-1"]!)).toBe(false)
  })

  it("empties the selected machine's part in the pattern on screen on Delete, and keeps the machine", async () => {
    const user = userEvent.setup()
    useRackStore.getState().setActivePattern(3)
    useRackStore.getState().toggleStep("drums-1", "kick", 0)
    useRackStore.getState().setActivePattern(0)
    renderWithChakra(<PatternBank />)
    await user.click(screen.getByRole("button", { name: "DR-4" }))
    await user.keyboard("{Delete}")
    expect(isTrackEmpty(useRackStore.getState().patterns[0]!.tracks["drums-1"]!)).toBe(true)
    expect(useRackStore.getState().instances.some((i) => i.id === "drums-1")).toBe(true)
    // The hat on pattern 1 (set in beforeEach) went too; pattern 4's kick is untouched.
    expect(isTrackEmpty(useRackStore.getState().patterns[3]!.tracks["drums-1"]!)).toBe(false)
  })
})
