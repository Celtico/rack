import { POLY_NOTES } from "../state/pattern"
import { selectTrack, useRackStore } from "../state/store"
import { StepGrid } from "./StepGrid"

/**
 * The chord grid of one polyphonic instance: highest note on top, any number
 * of notes per column. Subscribes to its track itself, so a bar change
 * re-renders the grid and not the unit (see `TrackGrids`).
 */
export function PolyGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const { toggleNote } = useRackStore.getState()
  if (!track || !("chords" in track)) return null

  const names = POLY_NOTES[track.kind]
  const rows = [...names]
    .map((note, rowIndex) => ({
      id: note,
      label: note,
      steps: track.chords.map((column) => column.includes(rowIndex)),
    }))
    .reverse()

  return (
    <StepGrid rows={rows} onToggle={(note, step) => toggleNote(id, step, names.indexOf(note))} />
  )
}
