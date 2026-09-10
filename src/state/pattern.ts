export const STEP_COUNT = 16

export const DRUM_VOICES = ["kick", "snare", "clap", "hat"] as const
export type DrumVoiceId = (typeof DRUM_VOICES)[number]

export const PERC_VOICES = ["tomLo", "tomHi", "rim", "cowbell", "shaker", "crash"] as const
export type PercVoiceId = (typeof PERC_VOICES)[number]

/** Any one-shot voice the scheduler can fire. Names are unique across kits. */
export type HitVoiceId = DrumVoiceId | PercVoiceId

/** MONO-1 rows, low to high. Row index in the pattern is an index into this list. */
export const SYNTH_NOTES = ["C2", "D2", "Eb2", "F2", "G2", "Ab2", "Bb2", "C3"] as const
export type SynthNote = (typeof SYNTH_NOTES)[number]

/** BASS-2 rows, low to high — an E minor pentatonic, the acid register. */
export const BASS_NOTES = ["E1", "G1", "A1", "B1", "D2", "E2", "G2", "A2"] as const
export type BassNote = (typeof BASS_NOTES)[number]

export type StepRow = readonly boolean[]
/** One on/off row per voice of a kit. */
export type KitRows<Id extends string> = Readonly<Record<Id, StepRow>>
/** One row index per column, or null for a rest. Monophonic by construction. */
export type SynthRow = readonly (number | null)[]

/** BASS-2: a note row plus per-step accent and slide flags. */
export interface BassRow {
  notes: SynthRow
  accent: StepRow
  slide: StepRow
}
export type BassFlag = "accent" | "slide"

export interface Pattern {
  drums: KitRows<DrumVoiceId>
  perc: KitRows<PercVoiceId>
  synth: SynthRow
  bass: BassRow
}

const row = (...on: number[]): StepRow =>
  Array.from({ length: STEP_COUNT }, (_, i) => on.includes(i))

/** Rows for every voice of a kit; `on` lists the steps that start lit. */
export function kitRows<Id extends string>(
  ids: readonly Id[],
  on: Partial<Record<Id, number[]>> = {},
): KitRows<Id> {
  const out = {} as Record<Id, StepRow>
  for (const id of ids) out[id] = row(...(on[id] ?? []))
  return out
}

/** A monophonic note row from (step, row) pairs. */
export function noteRow(...pairs: [step: number, row: number][]): SynthRow {
  const out: (number | null)[] = Array.from({ length: STEP_COUNT }, () => null)
  for (const [step, r] of pairs) out[step] = r
  return out
}

export function createEmptyPattern(): Pattern {
  return {
    drums: kitRows(DRUM_VOICES),
    perc: kitRows(PERC_VOICES),
    synth: noteRow(),
    bass: { notes: noteRow(), accent: row(), slide: row() },
  }
}

/** Four-on-the-floor, a small bassline and an acid line, so the rack makes sense the moment it plays. */
export function createDefaultPattern(): Pattern {
  return {
    drums: kitRows(DRUM_VOICES, {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14],
    }),
    perc: kitRows(PERC_VOICES, { shaker: [2, 6, 10, 14] }),
    synth: noteRow([0, 0], [3, 0], [6, 4], [8, 0], [11, 0], [13, 3], [14, 2]),
    bass: {
      notes: noteRow(
        [0, 0],
        [2, 0],
        [3, 0],
        [5, 0],
        [6, 2],
        [8, 0],
        [10, 0],
        [11, 3],
        [12, 0],
        [14, 5],
        [15, 4],
      ),
      accent: row(0, 6, 12),
      slide: row(14),
    },
  }
}

function toggleRow<Id extends string>(rows: KitRows<Id>, voice: Id, step: number): KitRows<Id> {
  return { ...rows, [voice]: rows[voice].map((on, i) => (i === step ? !on : on)) }
}

/** Sets a row in a column, replacing whatever was there; the same row again clears it. */
function toggleMonoNote(notes: SynthRow, step: number, rowIndex: number): SynthRow {
  return notes.map((r, i) => (i === step ? (r === rowIndex ? null : rowIndex) : r))
}

/** Returns a new pattern with one DR-4 step flipped. Never mutates the input. */
export function toggleDrumStep(pattern: Pattern, voice: DrumVoiceId, step: number): Pattern {
  return { ...pattern, drums: toggleRow(pattern.drums, voice, step) }
}

/** Returns a new pattern with one PERC-6 step flipped. Never mutates the input. */
export function togglePercStep(pattern: Pattern, voice: PercVoiceId, step: number): Pattern {
  return { ...pattern, perc: toggleRow(pattern.perc, voice, step) }
}

/**
 * Sets the MONO-1 note in a column, replacing whatever was there — at most one
 * note per column. Setting the row that is already on clears the column.
 */
export function toggleSynthNote(pattern: Pattern, step: number, rowIndex: number): Pattern {
  return { ...pattern, synth: toggleMonoNote(pattern.synth, step, rowIndex) }
}

/** Same rule as MONO-1, on the BASS-2 row. */
export function toggleBassNote(pattern: Pattern, step: number, rowIndex: number): Pattern {
  return {
    ...pattern,
    bass: { ...pattern.bass, notes: toggleMonoNote(pattern.bass.notes, step, rowIndex) },
  }
}

/** Flip the accent or slide flag of a BASS-2 step. */
export function toggleBassFlag(pattern: Pattern, step: number, flag: BassFlag): Pattern {
  const flags = pattern.bass[flag].map((on, i) => (i === step ? !on : on))
  return { ...pattern, bass: { ...pattern.bass, [flag]: flags } }
}

/** The MONO-1 note name sounding at a step, or null for a rest. */
export function synthNoteAt(pattern: Pattern, step: number): SynthNote | null {
  const rowIndex = pattern.synth[step]
  if (rowIndex === null || rowIndex === undefined) return null
  return SYNTH_NOTES[rowIndex] ?? null
}

/** What BASS-2 does at a step — sent every step so a held slide can be released on a rest. */
export interface BassStepEvent {
  note: BassNote | null
  accent: boolean
  slide: boolean
}

export function bassEventAt(pattern: Pattern, step: number): BassStepEvent {
  const rowIndex = pattern.bass.notes[step]
  const note = rowIndex === null || rowIndex === undefined ? null : (BASS_NOTES[rowIndex] ?? null)
  return {
    note,
    accent: pattern.bass.accent[step] === true,
    slide: pattern.bass.slide[step] === true,
  }
}
