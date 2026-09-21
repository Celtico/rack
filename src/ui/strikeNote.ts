import { getEngine } from "../audio/engine"
import type { KeyParams } from "../state/key"
import { rowNotes, STEP_COUNT, type PolyTrack } from "../state/pattern"
import { midiOfName, pickKeyForPitches } from "../state/tab"
import { selectInstance, selectTrack, useRackStore } from "../state/store"

/**
 * A note struck by hand on the fretboard: it sounds on the machine now, and,
 * while the clock runs, it is toggled in the step that is sounding (in the
 * pattern on screen) — tapping along writes the tune, tapping a note that is
 * already there takes it out. Stopped, it only sounds. One undo step each.
 */
export function strikeNote(id: string, row: number, note: string): void {
  void getEngine().playNotes(id, [note])
  const s = useRackStore.getState()
  if (s.currentStep < 0) return
  const track = selectTrack(s, id)
  if (track && "chords" in track) s.toggleNote(id, s.currentStep % STEP_COUNT, row)
}

/**
 * The step after the last one holding anything in a poly track — where a tab
 * read left to right goes next; null when the sixteen are used up.
 */
export function nextFreeStep(chords: readonly (readonly number[])[]): number | null {
  let last = -1
  chords.forEach((column, i) => {
    if (column.length > 0) last = i
  })
  return last + 1 < STEP_COUNT ? last + 1 : null
}

/**
 * Write a row into the pattern on screen at its next free step — "Add to
 * STR-6" from the fretboard. Returns the step it went in, or null when the
 * pattern is full. One undo step.
 */
export function appendNote(id: string, row: number): number | null {
  const s = useRackStore.getState()
  const track = selectTrack(s, id)
  if (!track || !("chords" in track)) return null
  const step = nextFreeStep(track.chords)
  if (step === null) return null
  s.toggleNote(id, step, row)
  return step
}

/** What writing a pitch into a STR-6 would take: the step, and a new key when the current one has no row for it. */
export interface AppendPlan {
  step: number
  /** The row the pitch has under the key in force after the plan. */
  row: number
  /** Set when the machine's key has to change to hold the pitch (with everything already written). */
  key?: KeyParams
}

const rowsMidi = (kind: "strings", key: KeyParams | undefined) =>
  rowNotes(kind, key).map(midiOfName)

/**
 * Plan writing a pitch (a MIDI number, any place on the neck) into the pattern
 * on screen at its next free step. When the key has no row for it, a key that
 * holds it together with every pitch already in the part is looked for —
 * keeping the current root and scale when a change of octave is enough — and
 * the plan carries it. Null when the bar is full or no key holds them all.
 */
export function planAppend(id: string, midi: number): AppendPlan | null {
  const s = useRackStore.getState()
  const inst = selectInstance(s, id)
  const track = selectTrack(s, id)
  if (inst?.kind !== "strings" || !track || !("chords" in track)) return null
  const step = nextFreeStep(track.chords)
  if (step === null) return null
  const current = rowsMidi("strings", inst.key)
  const row = current.indexOf(midi)
  if (row >= 0) return { step, row }
  const used = new Set(track.chords.flat().map((r) => current[r]!))
  used.add(midi)
  const choice = pickKeyForPitches(used, inst.key)
  if (choice.dropped > 0) return null
  const next = rowsMidi("strings", choice.key)
  return { step, row: next.indexOf(midi), key: choice.key }
}

/**
 * Carry out an `AppendPlan`: with a new key, the part's rows are re-indexed so
 * every note keeps its pitch, the key is set, and the note goes in; one undo
 * step for the lot. Returns the step written.
 */
export function applyAppend(id: string, plan: AppendPlan): number {
  const s = useRackStore.getState()
  if (plan.key) {
    const inst = selectInstance(s, id)
    const track = selectTrack(s, id) as PolyTrack
    const from = rowsMidi("strings", inst?.key)
    const to = rowsMidi("strings", plan.key)
    const chords = track.chords.map((column) =>
      column.map((r) => to.indexOf(from[r]!)).filter((r) => r >= 0),
    )
    s.beginStroke()
    s.setInstanceKey(id, plan.key)
    s.setTrack(id, s.activePattern, { kind: "strings", chords })
    s.toggleNote(id, plan.step, plan.row)
    s.endStroke()
    getEngine().syncFromStore()
  } else s.toggleNote(id, plan.step, plan.row)
  return plan.step
}
