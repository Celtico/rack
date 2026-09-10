import { Button, chakra, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { useRef, type ChangeEvent, type ReactNode } from "react"
import { LuCopy, LuDownload, LuUpload } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { PATTERN_COUNT } from "../state/patterns"
import { parseSong, serializeSong, SongParseError } from "../state/song"
import { toSong, useRackStore } from "../state/store"
import { Led } from "./Led"
import { RackUnit } from "./RackUnit"

const SLOTS = Array.from({ length: PATTERN_COUNT }, (_, i) => i)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack gap="2" align="flex-start">
      <Text textStyle="silkscreen" color="rack.silkscreen.muted">
        {title}
      </Text>
      {children}
    </VStack>
  )
}

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
    <RackUnit model="PATTERN" title="Bank · File">
      <Flex wrap="wrap" gap={{ base: "5", md: "8" }} align="flex-start">
        <Section title="Bank">
          <HStack gap="2" align="flex-end">
            {SLOTS.map((slot) => (
              <VStack key={slot} gap="1">
                <Led on={slot === playingPattern} label={`Pattern ${slot + 1} playing`} />
                <Button
                  size="sm"
                  rounded="sm"
                  variant={slot === activePattern ? "solid" : "subtle"}
                  colorPalette={slot === activePattern ? "orange" : "gray"}
                  aria-pressed={slot === activePattern}
                  aria-label={`Edit pattern ${slot + 1}`}
                  onClick={() => setActivePattern(slot)}
                >
                  {slot + 1}
                </Button>
              </VStack>
            ))}
            <Button
              size="sm"
              rounded="sm"
              variant="outline"
              onClick={() => copyActivePatternTo((activePattern + 1) % PATTERN_COUNT)}
              aria-label="Copy the active pattern to the next slot"
            >
              <LuCopy /> Copy →
            </Button>
          </HStack>
        </Section>

        <Section title="File">
          <HStack gap="2">
            <Button size="sm" rounded="sm" variant="subtle" onClick={save}>
              <LuDownload /> Save
            </Button>
            <Button
              size="sm"
              rounded="sm"
              variant="subtle"
              onClick={() => fileInput.current?.click()}
            >
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
        </Section>
      </Flex>
    </RackUnit>
  )
}
