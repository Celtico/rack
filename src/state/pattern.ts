export const STEP_COUNT = 16

export const DRUM_VOICES = ["kick", "snare", "clap", "hat"] as const
export type DrumVoiceId = (typeof DRUM_VOICES)[number]

/** MONO-1 rows, low to high. Row index in the pattern is an index into this list. */
export const SYNTH_NOTES = ["C2", "D2", "Eb2", "F2", "G2", "Ab2", "Bb2", "C3"] as const
export type SynthNote = (typeof SYNTH_NOTES)[number]

export type StepRow = readonly boolean[]
/** One row index per column, or null for a rest. Monophonic by construction. */
export type SynthRow = readonly (number | null)[]

export interface Pattern {
  drums: Readonly<Record<DrumVoiceId, StepRow>>
  synth: SynthRow
}

const row = (...on: number[]): StepRow =>
  Array.from({ length: STEP_COUNT }, (_, i) => on.includes(i))

const notes = (...pairs: [step: number, row: number][]): SynthRow => {
  const out: (number | null)[] = Array.from({ length: STEP_COUNT }, () => null)
  for (const [step, r] of pairs) out[step] = r
  return out
}

export function createEmptyPattern(): Pattern {
  return {
    drums: { kick: row(), snare: row(), clap: row(), hat: row() },
    synth: notes(),
  }
}

/** Four-on-the-floor plus a small bassline, so the rack makes sense the moment it plays. */
export function createDefaultPattern(): Pattern {
  return {
    drums: {
      kick: row(0, 4, 8, 12),
      snare: row(4, 12),
      clap: row(),
      hat: row(0, 2, 4, 6, 8, 10, 12, 14),
    },
    synth: notes([0, 0], [3, 0], [6, 4], [8, 0], [11, 0], [13, 3], [14, 2]),
  }
}

/** Returns a new pattern with one drum step flipped. Never mutates the input. */
export function toggleDrumStep(pattern: Pattern, voice: DrumVoiceId, step: number): Pattern {
  const current = pattern.drums[voice]
  const next = current.map((on, i) => (i === step ? !on : on))
  return { ...pattern, drums: { ...pattern.drums, [voice]: next } }
}

/**
 * Sets the synth note in a column, replacing whatever was there — at most one
 * note per column. Setting the row that is already on clears the column.
 */
export function toggleSynthNote(pattern: Pattern, step: number, rowIndex: number): Pattern {
  const next = pattern.synth.map((r, i) => (i === step ? (r === rowIndex ? null : rowIndex) : r))
  return { ...pattern, synth: next }
}

/** The note name sounding at a step, or null for a rest. */
export function synthNoteAt(pattern: Pattern, step: number): SynthNote | null {
  const rowIndex = pattern.synth[step]
  if (rowIndex === null || rowIndex === undefined) return null
  return SYNTH_NOTES[rowIndex] ?? null
}
