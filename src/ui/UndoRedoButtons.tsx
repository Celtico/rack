import { IconButton } from "@chakra-ui/react"
import { LuRedo2, LuUndo2 } from "react-icons/lu"

import { selectCanRedo, selectCanUndo, useRackStore } from "../state/store"
import { toolbarIconButton } from "./toolbar"
import { redoEdit, undoEdit } from "./undoRedo"

/** The toolbar's undo and redo, dimmed when there is nothing to step through. */
export function UndoRedoButtons() {
  const canUndo = useRackStore(selectCanUndo)
  const canRedo = useRackStore(selectCanRedo)
  return (
    <>
      <IconButton
        {...toolbarIconButton}
        aria-label="Undo"
        title="Undo (⌘Z)"
        disabled={!canUndo}
        onClick={undoEdit}
      >
        <LuUndo2 />
      </IconButton>
      <IconButton
        {...toolbarIconButton}
        aria-label="Redo"
        title="Redo (⇧⌘Z)"
        disabled={!canRedo}
        onClick={redoEdit}
      >
        <LuRedo2 />
      </IconButton>
    </>
  )
}
