import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { useRackStore } from "../state/store"

/** Take a machine out of the rack (store and engine), with an Undo toast that puts it back. */
export function removeInstanceWithUndo(id: string, label: string): void {
  const { removeInstance, restoreInstance } = useRackStore.getState()
  const removed = removeInstance(id)
  if (!removed) return
  getEngine().removeInstance(id)
  toaster.create({
    type: "info",
    title: `${label} removed`,
    description: "Its patterns went with it.",
    action: {
      label: "Undo",
      onClick: () => {
        restoreInstance(removed)
        getEngine().addInstance(removed.instance)
      },
    },
  })
}

/** DOM id of a unit's panel, for scrolling to it. */
export const unitDomId = (id: string) => `unit-${id}`

/** Bring a unit into view, under the sticky panels. */
export function scrollToUnit(id: string): void {
  document.getElementById(unitDomId(id))?.scrollIntoView({ behavior: "smooth", block: "start" })
}
