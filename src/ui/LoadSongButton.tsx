import { Button, chakra } from "@chakra-ui/react"
import { useRef, type ChangeEvent } from "react"
import { LuUpload } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { KIND_MODEL } from "../state/instances"
import { MidiImportError, songFromMidi } from "../state/midiImport"
import { parseSong, SongParseError } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { toolbarButton } from "./toolbar"

/**
 * "Load": a rack song (.json), or a standard MIDI file (.mid) converted onto
 * the grid. Lives in the Songs drawer, as a plain button; `toolbar` styles it
 * for the top strip instead.
 */
export function LoadSongButton({
  toolbar = false,
  onLoaded,
}: {
  toolbar?: boolean
  /** After a file has been put in the rack: its name without the extension. */
  onLoaded?: (name: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const { loadSong } = useRackStore.getState()

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const isMidi = /\.midi?$/i.test(file.name) || file.type === "audio/midi"
    // A file from outside is none of the library's songs; remember its name to offer it at save time.
    const name = file.name.replace(/\.[^.]+$/, "")
    useLibraryStore.getState().setNowPlaying(null)
    useLibraryStore.getState().setUnsavedName(name)
    try {
      if (isMidi) {
        const { song, report } = songFromMidi(await file.arrayBuffer())
        loadSong(song)
        getEngine().syncFromStore()
        const where = report.tracks.map((t) => `${t.name} → ${KIND_MODEL[t.kind]}`).join(", ")
        const notes = [
          report.moved ? `${report.moved} notes moved to fit` : "",
          report.dropped ? `${report.dropped} dropped` : "",
        ]
          .filter(Boolean)
          .join(", ")
        toaster.create({
          type: "success",
          title: `MIDI imported · ${report.bars} bar${report.bars === 1 ? "" : "s"}`,
          description: notes ? `${where}. ${notes}.` : where,
          duration: 8000,
        })
      } else {
        loadSong(parseSong(await file.text()))
        getEngine().syncFromStore()
        toaster.create({ type: "success", title: "Song loaded", description: file.name })
      }
      onLoaded?.(name)
    } catch (err) {
      const reason =
        err instanceof SongParseError || err instanceof MidiImportError
          ? err.message
          : "could not read the file"
      toaster.create({
        type: "error",
        title: isMidi ? "Could not import MIDI" : "Not a rack song",
        description: reason,
      })
    }
  }

  return (
    <>
      {/* Pinned to the left: the sr-only input is absolutely positioned, and in a right-aligned flex row its
          static position would be one pixel past the viewport, enough to give the page a horizontal scroll. */}
      <chakra.input
        ref={fileInput}
        type="file"
        accept="application/json,.json,audio/midi,.mid,.midi"
        onChange={load}
        srOnly
        insetInlineStart="0"
        aria-label="Load song or MIDI file"
      />
      {toolbar ? (
        <Button {...toolbarButton} onClick={() => fileInput.current?.click()}>
          <LuUpload /> Load
        </Button>
      ) : (
        <Button
          size="sm"
          variant="subtle"
          rounded="sm"
          flexShrink={0}
          onClick={() => fileInput.current?.click()}
        >
          <LuUpload /> Load .json / .mid
        </Button>
      )}
    </>
  )
}
