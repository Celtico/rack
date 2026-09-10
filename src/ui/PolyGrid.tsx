import { POLY_NOTES, type PolyTrack } from "../state/pattern"
import { useRackStore } from "../state/store"
import { StepGrid } from "./StepGrid"

/** The chord grid of one polyphonic instance: highest note on top, any number of notes per column. */
export function PolyGrid({ id, track }: { id: string; track: PolyTrack }) {
  const { toggleNote } = useRackStore.getState()

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
