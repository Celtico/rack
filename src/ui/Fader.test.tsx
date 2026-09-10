import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithChakra } from "../test/render"
import { Fader } from "./Fader"

describe("<Fader />", () => {
  it("is a labelled vertical slider that reports keyboard changes as 0–1", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithChakra(<Fader label="Level" value={0.5} onChange={onChange} />)

    const slider = screen.getByRole("slider", { hidden: true })
    expect(slider).toHaveAttribute("aria-orientation", "vertical")
    expect(slider).toHaveAttribute("aria-valuenow", "0.5")
    const labelId = slider.getAttribute("aria-labelledby")
    expect(labelId && document.getElementById(labelId)?.textContent).toBe("Level")

    slider.focus()
    await user.keyboard("{ArrowUp}")
    expect(onChange).toHaveBeenCalledWith(0.51)
    expect(screen.getByText("50%")).toBeInTheDocument()
  })
})
