import {
  parseTab,
  pickKeyFor,
  tabToPatterns,
  type TabColumn,
  type TabKeyChoice,
} from "../state/tab"
import { PATTERN_COUNT } from "../state/patterns"
import { isMelodicKind, type Track } from "../state/pattern"
import { selectInstance, useRackStore } from "../state/store"
import { getEngine } from "../audio/engine"

export interface TabImport {
  columns: TabColumn[]
  choice: TabKeyChoice
  /** The bank slots the tab was written into, the one on screen first. */
  slots: number[]
}

/** What a tab would become, before writing it: its columns and the key picked for them. */
export function readTab(text: string): { columns: TabColumn[]; choice: TabKeyChoice } {
  const columns = parseTab(text)
  return { columns, choice: pickKeyFor(columns) }
}

/**
 * A pattern of the tab as the machine's track: the chord grids take every note
 * of a column; MONO-1 and BASS-2, one note a step, take the highest — the
 * melody sits on top of a tab's chords. Null for a kit.
 */
function trackFor(kind: string, chords: number[][]): Track | null {
  const top = () => chords.map((c) => (c.length > 0 ? c[c.length - 1]! : null))
  switch (kind) {
    case "strings":
    case "poly":
    case "ep":
      return { kind, chords }
    case "synth":
      return { kind, notes: top() }
    case "bass":
      return {
        kind,
        bass: { notes: top(), accent: chords.map(() => false), slide: chords.map(() => false) },
      }
    default:
      return null
  }
}

/**
 * Write a tab into a melodic machine: its key becomes the one that holds the
 * most of the tab's notes, and the columns go a step each into the pattern on
 * screen and the slots after it (as many as the tab needs, up to the bank's
 * end); with more than one, the chain becomes those slots in order so Play
 * runs the tab through. Null when the text holds no tab or the machine is a
 * kit. One undo step per slot.
 */
export function writeTab(id: string, text: string): TabImport | null {
  const { columns, choice } = readTab(text)
  const s = useRackStore.getState()
  const inst = selectInstance(s, id)
  if (columns.length === 0 || !inst || !isMelodicKind(inst.kind)) return null
  s.setInstanceKey(id, choice.key)
  const patterns = tabToPatterns(columns, choice.key)
  const slots: number[] = []
  patterns.forEach((chords, i) => {
    const slot = s.activePattern + i
    if (slot >= PATTERN_COUNT) return
    const track = trackFor(inst.kind, chords)
    if (track && s.setTrack(id, slot, track)) slots.push(slot)
  })
  if (slots.length > 1) {
    s.clearChain()
    for (const slot of slots) s.appendToChain(slot)
  }
  getEngine().syncFromStore()
  return { columns, choice, slots }
}
