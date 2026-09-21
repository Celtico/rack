import { noteLabel, solfegeShort } from "../state/key"
import {
  DRUM_VOICES,
  PERC_VOICES,
  rowNotes,
  VIDEO_VOICES,
  type BassFlag,
  type KitRows,
  type VideoVoiceId,
} from "../state/pattern"
import { selectInstance, selectTrack, useRackStore } from "../state/store"
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

/**
 * MONO-1: one note per column on an 8-row grid. The rows are the machine's
 * key's notes (or its fixed ones without a key), highest on top like a piano
 * roll, labelled as a score reads them.
 */
export function SynthGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const key = useRackStore((s) => selectInstance(s, id)?.key)
  const { toggleNote } = useRackStore.getState()
  if (track?.kind !== "synth") return null
  const names = rowNotes("synth", key)
  const rows = [...names]
    .map((note, rowIndex) => ({
      id: note,
      label: noteLabel(note),
      text: solfegeShort(note),
      steps: track.notes.map((r) => r === rowIndex),
    }))
    .reverse()
  return (
    <StepGrid rows={rows} onToggle={(note, step) => toggleNote(id, step, names.indexOf(note))} />
  )
}

/** Highest note on top, then the two flag rows. */
const isFlag = (id: string): id is BassFlag => id === "accent" || id === "slide"

/** BASS-2: one note per column, plus accent and slide per step. */
export function BassGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const key = useRackStore((s) => selectInstance(s, id)?.key)
  const { toggleNote, toggleFlag } = useRackStore.getState()
  if (track?.kind !== "bass") return null
  const bass = track.bass
  const names = rowNotes("bass", key)
  const rows = [
    ...[...names]
      .map((note, rowIndex) => ({
        id: note,
        label: noteLabel(note),
        text: solfegeShort(note),
        steps: bass.notes.map((r) => r === rowIndex),
      }))
      .reverse(),
    { id: "accent", label: "Accent", steps: bass.accent },
    { id: "slide", label: "Slide", steps: bass.slide },
  ]
  const onToggle = (row: string, step: number) => {
    if (isFlag(row)) toggleFlag(id, step, row)
    else toggleNote(id, step, names.indexOf(row))
  }
  return <StepGrid rows={rows} onToggle={onToggle} />
}

/** VID-1 / MIC-1: the gate row — sixteen steps that let the sound through or cut it. */
export function GateGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const { toggleStep } = useRackStore.getState()
  if (!track || !("rows" in track)) return null
  const rows = VIDEO_VOICES.map((voice) => ({
    id: voice,
    label: VOICE_LABELS[voice] ?? voice,
    steps: (track.rows as Record<string, readonly boolean[]>)[voice] ?? [],
  }))
  return (
    <StepGrid rows={rows} onToggle={(voice: VideoVoiceId, step) => toggleStep(id, voice, step)} />
  )
}
