import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { StepGrid } from "./StepGrid"

const off = Array.from({ length: 16 }, () => false)
const rows = [
  { id: "kick", label: "Kick", steps: off.map((_, i) => i % 4 === 0) },
  { id: "hat", label: "Hat", steps: off },
] as const

describe("<StepGrid />", () => {
  beforeEach(() => useRackStore.setState({ currentStep: -1 }))

  it("renders one toggle button per row and step with pressed state", () => {
    renderWithChakra(<StepGrid rows={rows} onToggle={() => {}} />)

    const kick = within(screen.getByRole("group", { name: "Kick" }))
    expect(kick.getAllByRole("button")).toHaveLength(16)
    expect(kick.getByRole("button", { name: "Kick step 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(kick.getByRole("button", { name: "Kick step 2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getAllByRole("button")).toHaveLength(32)
  })

  it("prints a row's text in every cell, on or off", () => {
    const noted = [{ id: "G2", label: "Sol2", text: "Sol", steps: rows[0].steps }, rows[1]]
    renderWithChakra(<StepGrid rows={noted} onToggle={() => {}} />)

    const on = screen.getByRole("button", { name: "Sol2 step 1" })
    const off = screen.getByRole("button", { name: "Sol2 step 2" })
    expect(on).toHaveTextContent("Sol")
    expect(off).toHaveTextContent("Sol")
    expect(on).toHaveAttribute("data-text")
    // A row without text prints nothing.
    const hat = screen.getByRole("button", { name: "Hat step 1" })
    expect(hat).toBeEmptyDOMElement()
    expect(hat).not.toHaveAttribute("data-text")
  })

  it("reports toggles with the row id and zero-based step", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderWithChakra(<StepGrid rows={rows} onToggle={onToggle} />)

    await user.click(screen.getByRole("button", { name: "Hat step 7" }))
    expect(onToggle).toHaveBeenCalledWith("hat", 6)
  })

  it("marks accents on every fourth step and the playhead column", () => {
    useRackStore.setState({ currentStep: 5 })
    renderWithChakra(<StepGrid rows={rows} onToggle={() => {}} />)

    expect(screen.getByRole("button", { name: "Kick step 5" })).toHaveAttribute("data-accent")
    expect(screen.getByRole("button", { name: "Kick step 6" })).not.toHaveAttribute("data-accent")

    expect(screen.getByRole("button", { name: "Kick step 6" })).toHaveAttribute("data-playing")
    expect(screen.getByRole("button", { name: "Hat step 6" })).toHaveAttribute("data-playing")
    expect(screen.getByRole("button", { name: "Hat step 5" })).not.toHaveAttribute("data-playing")
  })
})
