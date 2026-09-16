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

  it("empties a machine's whole row when one of its parts is dropped on the surface", async () => {
    const user = userEvent.setup()
    useRackStore.getState().setActivePattern(3)
    useRackStore.getState().toggleStep("drums-1", "kick", 0)
    renderWithChakra(<PatternBank />)
    const surface = screen.getByText(/who plays in each pattern/i)
    fireEvent.drop(surface, { dataTransfer: transfer("application/x-rack-part", "drums-1:0") })
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(/DR-4's part in every pattern/)
    await user.click(screen.getByRole("button", { name: "Empty" }))
    await waitFor(() =>
      expect(
        useRackStore.getState().patterns.every((p) => isTrackEmpty(p.tracks["drums-1"]!)),
      ).toBe(true),
    )
    // The other machines' parts are untouched.
    expect(isTrackEmpty(useRackStore.getState().patterns[0]!.tracks["synth-1"]!)).toBe(false)
  })
})
