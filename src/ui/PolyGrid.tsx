import { noteLabel, solfegeShort } from "../state/key"
import { rowNotes } from "../state/pattern"
import { selectInstance, selectTrack, useRackStore } from "../state/store"
import { StepGrid } from "./StepGrid"

/**
 * The chord grid of one polyphonic instance: highest note on top, any number
 * of notes per column. Subscribes to its track itself, so a bar change
 * re-renders the grid and not the unit (see `TrackGrids`). The rows are the
 * machine's key's notes, labelled as a score reads them.
 */
export function PolyGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const key = useRackStore((s) => selectInstance(s, id)?.key)
  const { toggleNote } = useRackStore.getState()
  if (!track || !("chords" in track)) return null

  const names = rowNotes(track.kind, key)
  const rows = [...names]
    .map((note, rowIndex) => ({
      id: note,
      label: noteLabel(note),
      text: solfegeShort(note),
      steps: track.chords.map((column) => column.includes(rowIndex)),
    }))
    .reverse()

  return (
    <StepGrid rows={rows} onToggle={(note, step) => toggleNote(id, step, names.indexOf(note))} />
  )
}
