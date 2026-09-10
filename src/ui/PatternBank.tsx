import { Button, chakra, HStack, useSlotRecipe, VStack } from "@chakra-ui/react"
import { useRef, type ChangeEvent } from "react"
import { LuCopy, LuDownload, LuUpload } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { PATTERN_COUNT } from "../state/patterns"
import { parseSong, serializeSong, SongParseError } from "../state/song"
import { toSong, useRackStore } from "../state/store"

const SLOTS = Array.from({ length: PATTERN_COUNT }, (_, i) => i)

/** Trigger a download of `text` as a file. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Bank of four patterns and JSON save/load. The chain lives on the SONG timeline. */
export function PatternBank() {
  const activePattern = useRackStore((s) => s.activePattern)
  const playingPattern = useRackStore((s) => s.playingPattern)
  const { setActivePattern, copyActivePatternTo, loadSong } = useRackStore.getState()
  const fileInput = useRef<HTMLInputElement>(null)
  // Same blocks as the SONG bars: grey, lit in the pattern's colour while it sounds.
  const styles = useSlotRecipe({ key: "songTimeline" })()

  const save = () => {
    download("rack-song.json", serializeSong(toSong(useRackStore.getState())))
  }

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      loadSong(parseSong(await file.text()))
      getEngine().syncFromStore()
      toaster.create({ type: "success", title: "Song loaded", description: file.name })
    } catch (err) {
      const reason = err instanceof SongParseError ? err.message : "could not read the file"
      toaster.create({ type: "error", title: "Not a rack song", description: reason })
    }
  }

  return (
    <VStack gap="2" align="stretch" minW="0">
      <chakra.div css={styles.root}>
        <HStack gap="1" role="group" aria-label="Pattern bank" width="max-content">
          {SLOTS.map((slot) => (
            <chakra.button
              key={slot}
              type="button"
              css={styles.block}
              data-pattern={slot + 1}
              data-playing={slot === playingPattern ? "" : undefined}
              data-active={slot === activePattern ? "" : undefined}
              aria-pressed={slot === activePattern}
              aria-label={`Edit pattern ${slot + 1}`}
              onClick={() => setActivePattern(slot)}
            >
              <chakra.span css={styles.number}>{slot + 1}</chakra.span>
            </chakra.button>
          ))}
        </HStack>
      </chakra.div>
      {/* Under the slots: copy the active one, and the song file. */}
      <HStack gap="2" wrap="wrap">
        <Button
          size="sm"
          rounded="sm"
          variant="outline"
          onClick={() => copyActivePatternTo((activePattern + 1) % PATTERN_COUNT)}
          aria-label="Copy the active pattern to the next slot"
        >
          <LuCopy /> Copy →
        </Button>
        <Button size="sm" rounded="sm" variant="subtle" onClick={save}>
          <LuDownload /> Save
        </Button>
        <Button size="sm" rounded="sm" variant="subtle" onClick={() => fileInput.current?.click()}>
          <LuUpload /> Load
        </Button>
        <chakra.input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={load}
          srOnly
          aria-label="Load song file"
        />
      </HStack>
    </VStack>
  )
}
