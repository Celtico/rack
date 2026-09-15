export const STEP_COUNT = 16

/** Kinds of machine. Every instance in the rack is one of these. */
export const KINDS = ["drums", "perc", "sampler", "synth", "bass", "poly", "ep", "strings"] as const
export type Kind = (typeof KINDS)[number]

export const KIT_KINDS = ["drums", "perc", "sampler"] as const
export type KitKind = (typeof KIT_KINDS)[number]
export const POLY_KINDS = ["poly", "ep", "strings"] as const
export type PolyKind = (typeof POLY_KINDS)[number]

export const DRUM_VOICES = ["kick", "snare", "clap", "hat"] as const
export type DrumVoiceId = (typeof DRUM_VOICES)[number]

export const PERC_VOICES = ["tomLo", "tomHi", "rim", "cowbell", "shaker", "crash"] as const
export type PercVoiceId = (typeof PERC_VOICES)[number]

export const PAD_IDS = ["pad1", "pad2", "pad3", "pad4", "pad5", "pad6", "pad7", "pad8"] as const
export type PadId = (typeof PAD_IDS)[number]

/** The voices of each kit kind. */
export const KIT_VOICES: Readonly<Record<KitKind, readonly string[]>> = {
  drums: DRUM_VOICES,
  perc: PERC_VOICES,
  sampler: PAD_IDS,
}

/** MONO-1 rows, low to high. Row index in the pattern is an index into this list. */
export const SYNTH_NOTES = ["C2", "D2", "Eb2", "F2", "G2", "Ab2", "Bb2", "C3"] as const
export type SynthNote = (typeof SYNTH_NOTES)[number]

/** BASS-2 rows, low to high — an E minor pentatonic, the acid register. */
export const BASS_NOTES = ["E1", "G1", "A1", "B1", "D2", "E2", "G2", "A2"] as const
export type BassNote = (typeof BASS_NOTES)[number]

/** Rows of each polyphonic kind, low to high. */
export const POLY_NOTES: Readonly<Record<PolyKind, readonly string[]>> = {
  poly: ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4"],
  ep: ["C3", "E3", "G3", "B3", "D4", "E4", "G4", "B4"],
  strings: ["E2", "G2", "A2", "B2", "D3", "E3", "G3", "B3"],
}

export type StepRow = readonly boolean[]
/** One on/off row per voice of a kit. */
export type KitRows<Id extends string = string> = Readonly<Record<Id, StepRow>>
/** One row index per column, or null for a rest. Monophonic by construction. */
export type SynthRow = readonly (number | null)[]
/** Per column, the sorted row indices sounding — any number of them. */
export type PolyRow = readonly (readonly number[])[]

/** BASS-2: a note row plus per-step accent and slide flags. */
export interface BassRow {
  notes: SynthRow
  accent: StepRow
  slide: StepRow
}
export type BassFlag = "accent" | "slide"

/** What one instance plays in one pattern. */
export type Track =
  | { kind: "drums"; rows: KitRows<DrumVoiceId> }
  | { kind: "perc"; rows: KitRows<PercVoiceId> }
  | { kind: "sampler"; rows: KitRows<PadId> }
  | { kind: "synth"; notes: SynthRow }
  | { kind: "bass"; bass: BassRow }
  | { kind: "poly"; chords: PolyRow }
  | { kind: "ep"; chords: PolyRow }
  | { kind: "strings"; chords: PolyRow }

export type KitTrack = Extract<Track, { rows: unknown }>
export type PolyTrack = Extract<Track, { chords: unknown }>

/** The rows of a kit track under a plain string key — the voice set is decided by `kind`. */
export const rowsOf = (track: KitTrack): KitRows => track.rows as KitRows

/** One bank slot: a track per instance, keyed by instance id. */
export interface Pattern {
  tracks: Readonly<Record<string, Track>>
  /** Instances that keep their part but stay silent in this slot. Absent: everyone plays. */
  muted?: readonly string[]
}

/** Does `id` sit out this pattern? */
export const isMutedIn = (pattern: Pattern, id: string): boolean =>
  pattern.muted?.includes(id) === true

/** The pattern with `id` switched between playing and sitting out. Never mutates the input. */
export function togglePartMute(pattern: Pattern, id: string): Pattern {
  const muted = isMutedIn(pattern, id)
    ? (pattern.muted ?? []).filter((m) => m !== id)
    : [...(pattern.muted ?? []), id]
  const { muted: _was, ...rest } = pattern
  return muted.length ? { ...rest, muted } : rest
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

/** A polyphonic row from (step, rows) pairs. */
export function polyRow(...pairs: [step: number, rows: number[]][]): PolyRow {
  const out: number[][] = Array.from({ length: STEP_COUNT }, () => [])
  for (const [step, rows] of pairs) out[step] = [...rows].sort((a, b) => a - b)
  return out
}

/** A silent track of the given kind. */
export function emptyTrack(kind: Kind): Track {
  switch (kind) {
    case "drums":
      return { kind, rows: kitRows(DRUM_VOICES) }
    case "perc":
      return { kind, rows: kitRows(PERC_VOICES) }
    case "sampler":
      return { kind, rows: kitRows(PAD_IDS) }
    case "synth":
      return { kind, notes: noteRow() }
    case "bass":
      return { kind, bass: { notes: noteRow(), accent: row(), slide: row() } }
    case "poly":
    case "ep":
    case "strings":
      return { kind, chords: polyRow() }
  }
}

/** The starter groove for a kind — what the first instance of each plays on a fresh rack. */
export function starterTrack(kind: Kind): Track {
  switch (kind) {
    case "drums":
      return {
        kind,
        rows: kitRows(DRUM_VOICES, {
          kick: [0, 4, 8, 12],
          snare: [4, 12],
          hat: [0, 2, 4, 6, 8, 10, 12, 14],
        }),
      }
    case "perc":
      return { kind, rows: kitRows(PERC_VOICES, { shaker: [2, 6, 10, 14] }) }
    case "sampler":
      return emptyTrack(kind)
    case "synth":
      return { kind, notes: noteRow([0, 0], [3, 0], [6, 4], [8, 0], [11, 0], [13, 3], [14, 2]) }
    case "bass":
      return {
        kind,
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
    case "poly":
      return { kind, chords: polyRow([0, [0, 2, 4]], [8, [1, 3, 5]]) }
    case "ep":
      return { kind, chords: polyRow([4, [0, 2, 4]], [12, [1, 3, 5]]) }
    case "strings":
      return {
        kind,
        chords: polyRow(
          [0, [0]],
          [2, [2]],
          [4, [4]],
          [6, [6]],
          [8, [1]],
          [10, [3]],
          [12, [5]],
          [14, [7]],
        ),
      }
  }
}

export interface TrackOwner {
  id: string
  kind: Kind
}

/** A pattern with an empty track for each instance. */
export function createEmptyPattern(instances: readonly TrackOwner[]): Pattern {
  return {
    tracks: Object.fromEntries(instances.map(({ id, kind }) => [id, emptyTrack(kind)])),
  }
}

/** A pattern with the starter groove on every instance. */
export function createStarterPattern(instances: readonly TrackOwner[]): Pattern {
  return {
    tracks: Object.fromEntries(instances.map(({ id, kind }) => [id, starterTrack(kind)])),
  }
}

/** Replace one instance's track. Never mutates the input. */
export function withTrack(pattern: Pattern, id: string, track: Track): Pattern {
  return { ...pattern, tracks: { ...pattern.tracks, [id]: track } }
}

export function withoutTrack(pattern: Pattern, id: string): Pattern {
  const tracks = { ...pattern.tracks }
  delete tracks[id]
  const muted = pattern.muted?.filter((m) => m !== id)
  return muted?.length ? { tracks, muted } : { tracks }
}

const flip = (steps: StepRow, step: number): StepRow =>
  steps.map((on, i) => (i === step ? !on : on))

/** Sets a row in a column, replacing whatever was there; the same row again clears it. */
const toggleMono = (notes: SynthRow, step: number, rowIndex: number): SynthRow =>
  notes.map((r, i) => (i === step ? (r === rowIndex ? null : rowIndex) : r))

/** Add or remove one note of a chord. Rows stay sorted so equal chords compare equal. */
const toggleChord = (chords: PolyRow, step: number, rowIndex: number): PolyRow =>
  chords.map((column, i) => {
    if (i !== step) return column
    return column.includes(rowIndex)
      ? column.filter((r) => r !== rowIndex)
      : [...column, rowIndex].sort((a, b) => a - b)
  })

/** Flip one step of one voice on a kit track. Never mutates the input. */
export function toggleKitStep(track: KitTrack, voice: string, step: number): KitTrack {
  const rows = track.rows as KitRows
  if (!(voice in rows)) return track
  return { ...track, rows: { ...rows, [voice]: flip(rows[voice]!, step) } } as KitTrack
}

/**
 * Toggle a note on a melodic track: monophonic replace-or-clear for MONO-1
 * and BASS-2, add-or-remove within the chord for the polyphonic kinds.
 */
export function toggleTrackNote(track: Track, step: number, rowIndex: number): Track {
  switch (track.kind) {
    case "synth":
      return { ...track, notes: toggleMono(track.notes, step, rowIndex) }
    case "bass":
      return {
        ...track,
        bass: { ...track.bass, notes: toggleMono(track.bass.notes, step, rowIndex) },
      }
    case "poly":
    case "ep":
    case "strings":
      return { ...track, chords: toggleChord(track.chords, step, rowIndex) }
    default:
      return track
  }
}

/** Flip the accent or slide flag of a BASS-2 step. */
export function toggleBassFlag(track: Track, step: number, flag: BassFlag): Track {
  if (track.kind !== "bass") return track
  return { ...track, bass: { ...track.bass, [flag]: flip(track.bass[flag], step) } }
}

/** True when nothing on the track ever sounds. */
export function isTrackEmpty(track: Track): boolean {
  switch (track.kind) {
    case "drums":
    case "perc":
    case "sampler":
      return Object.values(rowsOf(track)).every((row) => row.every((on) => !on))
    case "synth":
      return track.notes.every((r) => r === null)
    case "bass":
      return track.bass.notes.every((r) => r === null)
    case "poly":
    case "ep":
    case "strings":
      return track.chords.every((column) => column.length === 0)
  }
}

/** True when no instance plays anything in the pattern — a bank slot with nothing in it. */
export const isPatternEmpty = (pattern: Pattern): boolean =>
  Object.values(pattern.tracks).every(isTrackEmpty)

/** Voices of a kit track that are on at a step. */
export function hitsAt(track: KitTrack, step: number): string[] {
  const rows = track.rows as KitRows
  return KIT_VOICES[track.kind].filter((voice) => rows[voice]?.[step] === true)
}

/** The MONO-1 note name sounding at a step, or null for a rest. */
export function synthNoteAt(notes: SynthRow, step: number): SynthNote | null {
  const rowIndex = notes[step]
  if (rowIndex === null || rowIndex === undefined) return null
  return SYNTH_NOTES[rowIndex] ?? null
}

/** The note names a polyphonic track plays at a step — empty for a rest. */
export function polyNotesAt(track: PolyTrack, step: number): string[] {
  const names = POLY_NOTES[track.kind]
  return (track.chords[step] ?? []).flatMap((r) => names[r] ?? [])
}

/** What BASS-2 does at a step — sent every step so a held slide can be released on a rest. */
export interface BassStepEvent {
  note: BassNote | null
  accent: boolean
  slide: boolean
}

export function bassEventAt(bass: BassRow, step: number): BassStepEvent {
  const rowIndex = bass.notes[step]
  const note = rowIndex === null || rowIndex === undefined ? null : (BASS_NOTES[rowIndex] ?? null)
  return { note, accent: bass.accent[step] === true, slide: bass.slide[step] === true }
}
