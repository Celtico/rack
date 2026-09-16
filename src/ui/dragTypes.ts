import { useEffect } from "react"

/** `DataTransfer` types of the rack's own drags, so panels can take each other's drops. */

/**
 * Clears a "drop target" mark once any drag ends, wherever it ended: a drag
 * dropped outside the target, or cancelled with Escape, leaves the target
 * without a `dragleave`, and the outline would stay on.
 */
export function useClearOnDragEnd(marked: boolean, clear: () => void): void {
  useEffect(() => {
    if (!marked) return
    document.addEventListener("dragend", clear)
    document.addEventListener("drop", clear)
    return () => {
      document.removeEventListener("dragend", clear)
      document.removeEventListener("drop", clear)
    }
  }, [marked, clear])
}

/** A bank slot being dragged: the slot index as text. */
export const PATTERN_DRAG = "application/x-rack-pattern"
/** A part being dragged from the bank's matrix: `<instance id>:<slot>`. */
export const PART_DRAG = "application/x-rack-part"

/** The bank slot a drop carries, or null when the drag is something else. */
export function droppedPattern(dt: DataTransfer): number | null {
  const data = dt.getData(PATTERN_DRAG)
  if (data === "") return null
  const slot = Number(data)
  return Number.isInteger(slot) ? slot : null
}
