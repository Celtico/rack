import { POLY_NOTES, type PolyInstrumentId } from "../state/pattern"
import { selectPattern, useRackStore } from "../state/store"
import { StepGrid } from "./StepGrid"

/** The chord grid of one polyphonic instrument: highest note on top, any number of notes per column. */
export function PolyGrid({ instrument }: { instrument: PolyInstrumentId }) {
  const columns = useRackStore((s) => selectPattern(s).poly[instrument])
  const currentStep = useRackStore((s) => s.currentStep)
  const { togglePolyNote } = useRackStore.getState()

  const names = POLY_NOTES[instrument]
  const rows = [...names]
    .map((note, rowIndex) => ({
      id: note,
      label: note,
      steps: columns.map((column) => column.includes(rowIndex)),
    }))
    .reverse()

  return (
    <StepGrid
      rows={rows}
      currentStep={currentStep}
      onToggle={(note, step) => togglePolyNote(instrument, step, names.indexOf(note))}
    />
  )
}
