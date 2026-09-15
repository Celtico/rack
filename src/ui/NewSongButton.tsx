import { Button } from "@chakra-ui/react"
import { LuFilePlus } from "react-icons/lu"

import { toaster } from "../components/ui/toaster"
import { newSong, restoreRack } from "./defaultSong"

/**
 * "New song", in the Songs panel: the rack as it opens the first time —
 * stopped, empty, every panel back. What it held comes back through the
 * toast's Undo.
 */
export function NewSongButton({ onNew }: { onNew?: () => void }) {
  const startNew = () => {
    const before = newSong()
    onNew?.()
    toaster.create({
      type: "info",
      title: "New song",
      description: "An empty rack — add units to build it.",
      action: { label: "Undo", onClick: () => restoreRack(before) },
    })
  }
  return (
    <Button size="sm" variant="subtle" rounded="sm" flexShrink={0} onClick={startNew}>
      <LuFilePlus /> New song
    </Button>
  )
}
