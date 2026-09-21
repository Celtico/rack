import {
  parseTab,
  pickKeyFor,
  tabToPatterns,
  type TabColumn,
  type TabKeyChoice,
} from "../state/tab"
import { PATTERN_COUNT } from "../state/patterns"
import { useRackStore } from "../state/store"
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
 * Write a tab into a STR-6: its key becomes the one that holds the most of the
 * tab's notes, and the columns go a step each into the pattern on screen and
 * the slots after it (as many as the tab needs, up to the bank's end); with
 * more than one, the chain becomes those slots in order so Play runs the tab
 * through. Null when the text holds no tab. One undo step per slot.
 */
export function writeTab(id: string, text: string): TabImport | null {
  const { columns, choice } = readTab(text)
  if (columns.length === 0) return null
  const s = useRackStore.getState()
  s.setInstanceKey(id, choice.key)
  const patterns = tabToPatterns(columns, choice.key)
  const slots: number[] = []
  patterns.forEach((chords, i) => {
    const slot = s.activePattern + i
    if (slot >= PATTERN_COUNT) return
    if (s.setTrack(id, slot, { kind: "strings", chords })) slots.push(slot)
  })
  if (slots.length > 1) {
    s.clearChain()
    for (const slot of slots) s.appendToChain(slot)
  }
  getEngine().syncFromStore()
  return { columns, choice, slots }
}
