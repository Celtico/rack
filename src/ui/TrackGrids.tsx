import {
  BASS_NOTES,
  DRUM_VOICES,
  PERC_VOICES,
  SYNTH_NOTES,
  type BassFlag,
  type BassNote,
  type KitRows,
  type SynthNote,
} from "../state/pattern"
import { selectTrack, useRackStore } from "../state/store"
import { StepGrid } from "./StepGrid"
import { VOICE_LABELS } from "./unitMeta"

/**
 * The grids of the units, each subscribing to its own track. While a song
 * plays, the sounding bar's pattern is the one on screen, so every track
 * changes once a bar: a grid that reads it here re-renders alone, and the
 * unit around it — header, knobs, fold — stays put. Six units re-rendering
 * whole on every bar cost ~200 ms on a laptop and lost the beat on a phone.
 */

/** DR-4 / PERC-6: one row per voice. */
export function KitGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const { toggleStep } = useRackStore.getState()
  if (!track || !("rows" in track)) return null
  const voices = track.kind === "drums" ? DRUM_VOICES : PERC_VOICES
  const rows = track.rows as KitRows
  const gridRows = voices.map((voice) => ({
    id: voice,
    label: VOICE_LABELS[voice] ?? voice,
    steps: rows[voice] ?? [],
  }))
  return <StepGrid rows={gridRows} onToggle={(voice, step) => toggleStep(id, voice, step)} />
}

/** Highest note on top, like a piano roll. */
const SYNTH_ROWS = [...SYNTH_NOTES].reverse()

/** MONO-1: one note per column on an 8-row grid. */
export function SynthGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const { toggleNote } = useRackStore.getState()
  if (track?.kind !== "synth") return null
  const rows = SYNTH_ROWS.map((note) => {
    const rowIndex = SYNTH_NOTES.indexOf(note)
    return { id: note, label: note, steps: track.notes.map((r) => r === rowIndex) }
  })
  return (
    <StepGrid
      rows={rows}
      onToggle={(note: SynthNote, step) => toggleNote(id, step, SYNTH_NOTES.indexOf(note))}
    />
  )
}

/** Highest note on top, then the two flag rows. */
const BASS_ROWS = [...BASS_NOTES].reverse()
type BassRowId = BassNote | BassFlag
const isFlag = (id: BassRowId): id is BassFlag => id === "accent" || id === "slide"

/** BASS-2: one note per column, plus accent and slide per step. */
export function BassGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const { toggleNote, toggleFlag } = useRackStore.getState()
  if (track?.kind !== "bass") return null
  const bass = track.bass
  const rows = [
    ...BASS_ROWS.map((note) => {
      const rowIndex = BASS_NOTES.indexOf(note)
      return { id: note as BassRowId, label: note, steps: bass.notes.map((r) => r === rowIndex) }
    }),
    { id: "accent" as BassRowId, label: "Accent", steps: bass.accent },
    { id: "slide" as BassRowId, label: "Slide", steps: bass.slide },
  ]
  const onToggle = (row: BassRowId, step: number) => {
    if (isFlag(row)) toggleFlag(id, step, row)
    else toggleNote(id, step, BASS_NOTES.indexOf(row))
  }
  return <StepGrid rows={rows} onToggle={onToggle} />
}
