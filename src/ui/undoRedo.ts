import { getEngine } from "../audio/engine"
import { useRackStore } from "../state/store"

/** Undo the last edit and make the graph match; false when there was nothing. */
export function undoEdit(): boolean {
  if (!useRackStore.getState().undo()) return false
  getEngine().syncFromStore()
  return true
}

export function redoEdit(): boolean {
  if (!useRackStore.getState().redo()) return false
  getEngine().syncFromStore()
  return true
}

/** True when the key press belongs to a field the user is typing in. */
const inTextField = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Which of undo or redo a key press asks for: ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y / Ctrl+Shift+Z. */
export function undoKey(e: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): "undo" | "redo" | null {
  if (e.altKey || !(e.metaKey || e.ctrlKey)) return null
  const key = e.key.toLowerCase()
  if (key === "z") return e.shiftKey ? "redo" : "undo"
  if (key === "y" && e.ctrlKey && !e.shiftKey) return "redo"
  return null
}

/** Keyboard undo/redo for the whole page, except inside text fields. Returns the uninstaller. */
export function installUndoKeys(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const action = undoKey(e)
    if (!action || inTextField(e.target)) return
    e.preventDefault()
    if (action === "undo") undoEdit()
    else redoEdit()
  }
  window.addEventListener("keydown", onKeyDown)
  return () => window.removeEventListener("keydown", onKeyDown)
}
