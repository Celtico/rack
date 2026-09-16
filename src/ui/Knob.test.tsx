import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithChakra } from "../test/render"
import { Knob } from "./Knob"

describe("<Knob />", () => {
  it("moves a linear knob by one step per arrow key and clamps at the ends", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithChakra(
      <Knob label="Level" value={0.5} min={0} max={1} step={0.1} onChange={onChange} />,
    )

    const knob = screen.getByRole("slider", { name: "Level" })
    knob.focus()
    await user.keyboard("{ArrowUp}")
    expect(onChange).toHaveBeenLastCalledWith(0.6)
    await user.keyboard("{Home}")
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it("stops turning once the button is found released, even without a pointerup", () => {
    const onChange = vi.fn()
    renderWithChakra(
      <Knob label="Level" value={0.5} min={0} max={1} step={0.01} onChange={onChange} />,
    )
    const knob = screen.getByRole("slider", { name: "Level" })
    fireEvent.pointerDown(knob, { pointerId: 1, clientY: 100, buttons: 1 })
    fireEvent.pointerMove(knob, { pointerId: 1, clientY: 90, buttons: 1 })
    expect(onChange).toHaveBeenCalledTimes(1)
    // The pointerup went elsewhere; the pointer comes back over the knob with no button down.
    fireEvent.pointerMove(knob, { pointerId: 1, clientY: 40, buttons: 0 })
    fireEvent.pointerMove(knob, { pointerId: 1, clientY: 20, buttons: 0 })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("moves a log knob by a slice of travel, so steps grow with the value", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithChakra(
      <Knob
        label="Cutoff"
        value={80}
        min={80}
        max={8000}
        step={1}
        scale="log"
        onChange={onChange}
      />,
    )

    screen.getByRole("slider", { name: "Cutoff" }).focus()
    await user.keyboard("{ArrowUp}")
    const low = onChange.mock.lastCall?.[0] as number
    // 2% of travel from 80 Hz ≈ ×1.096 → 88 Hz, not 81 Hz.
    expect(low).toBeGreaterThan(85)
    expect(low).toBeLessThan(92)

    await user.keyboard("{End}")
    expect(onChange).toHaveBeenLastCalledWith(8000)
  })

  it("exposes value text and reports it via aria-valuetext", () => {
    renderWithChakra(
      <Knob
        label="Decay"
        value={0.25}
        min={0}
        max={2}
        format={(v) => `${v} s`}
        onChange={() => {}}
      />,
    )
    const knob = screen.getByRole("slider", { name: "Decay" })
    expect(knob).toHaveAttribute("aria-valuetext", "0.25 s")
    expect(knob).toHaveAttribute("aria-valuemax", "2")
  })
})
