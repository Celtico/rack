import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { Transport } from "./Transport"

const engine = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  setBpm: vi.fn(),
  setMasterVolume: vi.fn(),
}

vi.mock("../audio/engine", () => ({
  getEngine: () => engine,
}))

describe("<Transport />", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRackStore.setState({
      bpm: 120,
      playing: false,
      currentStep: -1,
      playingPattern: -1,
      masterVolume: 0.8,
    })
  })

  it("starts and stops the engine from the play button", async () => {
    const user = userEvent.setup()
    renderWithChakra(<Transport />)

    const play = screen.getByRole("button", { name: "Play" })
    expect(play).toHaveAttribute("aria-pressed", "false")

    await user.click(play)
    expect(engine.start).toHaveBeenCalledTimes(1)
    expect(useRackStore.getState().playing).toBe(true)

    await user.click(screen.getByRole("button", { name: "Stop" }))
    expect(engine.stop).toHaveBeenCalledTimes(1)
    expect(useRackStore.getState().playing).toBe(false)
  })

  it("exposes the tempo knob as an accessible slider driven by the keyboard", async () => {
    const user = userEvent.setup()
    renderWithChakra(<Transport />)

    const tempo = screen.getByRole("slider", { name: "Tempo" })
    expect(tempo).toHaveAttribute("aria-valuenow", "120")
    expect(tempo).toHaveAttribute("aria-valuetext", "120 BPM")

    tempo.focus()
    await user.keyboard("{ArrowUp}{ArrowUp}{PageUp}")
    expect(useRackStore.getState().bpm).toBe(132)
    expect(engine.setBpm).toHaveBeenLastCalledWith(132)

    await user.keyboard("{End}")
    expect(tempo).toHaveAttribute("aria-valuenow", "240")
  })
})
