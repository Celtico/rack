import { fireEvent, screen, waitFor } from "@testing-library/react"
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

/**
 * Press a place (the press sounds it) and click it (the click opens its menu), then let the menu
 * settle: its machine takes a tick to listen to its items.
 */
const openMenuOn = async (name: string) => {
  const place = screen.getByRole("button", { name })
  fireEvent.pointerDown(place, { button: 0 })
  fireEvent.click(place)
  await screen.findByRole("menu")
  await new Promise<void>((r) => setTimeout(r, 30))
}

const chordsAt = (step: number) => {
  const track = useRackStore.getState().patterns[0]!.tracks["strings-1"]
  return track && "chords" in track ? track.chords[step] : undefined
}

describe("<Fretboard />", () => {
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

  it("draws one dot per row that the neck reaches, named in solfège with its place", () => {
    renderWithChakra(<Fretboard id="strings-1" />)
    // G major at octave 2: G2 (low E, fret 3) … G3 (open G string).
    expect(screen.getByRole("button", { name: "Sol2 · G, string 6 fret 3" })).toHaveTextContent(
      "Sol",
    )
    expect(screen.getByRole("button", { name: "Sol3 · G, string 3 fret 0" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /·/ })).toHaveLength(8)
  })

  it("strikes a pressed row dot and writes nothing while the clock is stopped", () => {
    renderWithChakra(<Fretboard id="strings-1" />)
    const dot = screen.getByRole("button", { name: "Si2 · B, string 5 fret 2" })
    fireEvent.pointerDown(dot, { button: 0 })
    expect(engine.playNotes).toHaveBeenCalledWith("strings-1", ["B2"])
    expect(dot).toHaveAttribute("data-hit")
    expect(chordsAt(0)).toEqual([])
  })

  it("toggles a struck row dot in the sounding step while the clock runs", () => {
    useRackStore.setState({ currentStep: 5 })
    renderWithChakra(<Fretboard id="strings-1" />)
    const dot = screen.getByRole("button", { name: "Si2 · B, string 5 fret 2" })
    fireEvent.keyDown(dot, { key: "Enter" })
    expect(chordsAt(5)).toEqual([2])
    fireEvent.keyDown(dot, { key: " " })
    expect(chordsAt(5)).toEqual([])
    expect(engine.playNotes).toHaveBeenCalledTimes(2)
  })

  // One menu per test file: under jsdom the second Chakra menu opened in a document — even from a
  // fresh mount, in a later test — no longer takes its items' presses (a real browser does, checked
  // by hand). So this file opens one menu, and "Add to STR-6" has a file of its own.

  it("opens a menu on a pressed place: Add puts a mark there, Play plays it, Delete takes it off", async () => {
    const user = userEvent.setup()
    renderWithChakra(<Fretboard id="strings-1" />)
    expect(screen.getByRole("button", { name: "Play the notes on the fretboard" })).toBeDisabled()
    // String 1 (the high E) fret 3 is G4: not one of G major at octave 2's rows.
    await openMenuOn("String 1 fret 3")
    expect(engine.playNotes).toHaveBeenCalledWith("strings-1", ["G4"])
    expect(screen.getByRole("menu")).toHaveTextContent(/Sol4 · G · string 1 · fret 3/)
    // The pattern is empty, so a key that holds G4 can be taken: the item says which.
    expect(screen.getByRole("menuitem", { name: /Add to STR-6/ })).toHaveTextContent(
      /step 1 · key → /,
    )
    await user.click(screen.getByRole("menuitem", { name: "Add to the fretboard" }))
    const mark = await screen.findByRole("button", {
      name: "Sol4 · G, string 1 fret 3, on the fretboard",
    })
    expect(mark).toHaveTextContent("Sol")
    expect(chordsAt(0)).toEqual([])
    // …and the tab readout prints it on the thin E's line.
    expect(screen.getByLabelText("The notes on the fretboard as a tablature")).toHaveTextContent(
      /e\|-3-/,
    )
    // Pressing the mark sounds it again.
    fireEvent.pointerDown(mark, { button: 0 })
    expect(engine.playNotes).toHaveBeenCalledTimes(2)
    // Play: the marks an eighth apart at 120 BPM — a quarter of a second.
    engine.playNotes.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Play the notes on the fretboard" }))
    expect(engine.playNotes).toHaveBeenCalledWith("strings-1", ["G4"], 0.25)
    // Delete on the mark takes it off; Clear would take them all.
    fireEvent.keyDown(mark, { key: "Delete" })
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Sol4 · G, string 1 fret 3, on the fretboard" }),
      ).toBeNull(),
    )
    expect(screen.getByRole("button", { name: "Take every note off the fretboard" })).toBeDisabled()
  })

  it("takes the key's dots off one by one with Delete, all at once with Key notes, and puts them back", async () => {
    const user = userEvent.setup()
    renderWithChakra(<Fretboard id="strings-1" />)
    expect(screen.getAllByRole("button", { name: /·/ })).toHaveLength(8)
    fireEvent.keyDown(screen.getByRole("button", { name: "Sol2 · G, string 6 fret 3" }), {
      key: "Delete",
    })
    expect(screen.queryByRole("button", { name: "Sol2 · G, string 6 fret 3" })).toBeNull()
    expect(screen.getAllByRole("button", { name: /·/ })).toHaveLength(7)
    const toggle = screen.getByRole("button", { name: "Show the key's notes on the fretboard" })
    await user.click(toggle)
    expect(screen.queryAllByRole("button", { name: /·/ })).toHaveLength(0)
    await user.click(toggle)
    expect(screen.getAllByRole("button", { name: /·/ })).toHaveLength(8)
  })

  it("lights the dots of the column that is sounding", () => {
    useRackStore.getState().toggleNote("strings-1", 3, 0)
    renderWithChakra(<Fretboard id="strings-1" />)
    const dot = screen.getByRole("button", { name: "Sol2 · G, string 6 fret 3" })
    expect(dot).not.toHaveAttribute("data-on")
    useRackStore.setState({ currentStep: 3 })
    expect(dot).toHaveAttribute("data-on")
    useRackStore.setState({ currentStep: 4 })
    expect(dot).not.toHaveAttribute("data-on")
  })
})
