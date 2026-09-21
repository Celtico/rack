import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { emptyHistory } from "../state/history"
import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { useRackStore } from "../state/store"
import { renderWithChakra } from "../test/render"
import { Fretboard } from "./Fretboard"

const engine = { playNotes: vi.fn().mockResolvedValue(undefined) }
vi.mock("../audio/engine", () => ({ getEngine: () => engine }))

const chordsAt = (step: number) => {
  const track = useRackStore.getState().patterns[0]!.tracks["strings-1"]
  return track && "chords" in track ? track.chords[step] : undefined
}

/**
 * "Add to STR-6" from the fretboard's menu. Its own file: under jsdom only the first Chakra menu
 * opened in a document takes its items' presses (see `Fretboard.test.tsx`).
 */
describe("<Fretboard /> · Add to STR-6", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const instances = defaultInstances().filter((i) => i.kind !== "strings")
    useRackStore.setState({
      instances,
      patterns: createDefaultBank(instances),
      activePattern: 0,
      playingPattern: -1,
      currentStep: -1,
      bpm: 120,
      history: emptyHistory(),
      stroke: null,
    })
    useRackStore.getState().addInstance("strings")
    useRackStore.getState().setInstanceKey("strings-1", { root: 7, scale: "major", octave: 2 })
  })

  it("writes the note of one of the key's dots into the pattern after the last note written", async () => {
    const user = userEvent.setup()
    // Step 1 already holds the fourth row (C3): the next free step is 2 — a tab read left to right.
    useRackStore.getState().toggleNote("strings-1", 0, 3)
    renderWithChakra(<Fretboard id="strings-1" />)
    const dot = screen.getByRole("button", { name: "Si2 · B, string 5 fret 2" })
    fireEvent.pointerDown(dot, { button: 0 })
    fireEvent.click(dot)
    await screen.findByRole("menu")
    await new Promise<void>((r) => setTimeout(r, 30))
    expect(screen.getByRole("menu")).toHaveTextContent(/Si2 · B · string 5 · fret 2/)
    await user.click(screen.getByRole("menuitem", { name: "Add to STR-6 · step 2" }))
    expect(chordsAt(1)).toEqual([2])
    expect(chordsAt(0)).toEqual([3])
    expect(engine.playNotes).toHaveBeenCalledWith("strings-1", ["B2"])
  })
})
