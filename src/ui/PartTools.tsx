import { Button, HStack, Text, VStack } from "@chakra-ui/react"
import { LuDices, LuRotateCcw, LuVolume2, LuVolumeX } from "react-icons/lu"

import { isMutedIn, type Kind } from "../state/pattern"
import { selectPattern, useRackStore } from "../state/store"
import { pushSound } from "./unitMeta"

const MELODIC: readonly Kind[] = ["synth", "bass", "poly", "ep", "strings"]

/**
 * What acts on the part in the grid (the pattern on screen): a random one.
 * The sound is left alone — that has its own dice in the header.
 */
export function PartTools({ id, kind }: { id: string; kind: Kind }) {
  const activePattern = useRackStore((s) => s.activePattern)
  const sitsOut = useRackStore((s) => isMutedIn(selectPattern(s), id))
  const { randomizePart, randomizeFilter, resetFilter, togglePartMute } = useRackStore.getState()
  const notes = MELODIC.includes(kind)
  return (
    <HStack gap="6" wrap="wrap" align="flex-start">
      <VStack gap="2" align="flex-start">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          Pattern {activePattern + 1}
        </Text>
        <HStack gap="2" wrap="wrap">
          {/* Sit this slot out, keeping the part: the pattern's own mute for this machine. */}
          <Button
            size="xs"
            variant={sitsOut ? "solid" : "subtle"}
            colorPalette={sitsOut ? "orange" : undefined}
            rounded="sm"
            aria-pressed={sitsOut}
            aria-label={`${sitsOut ? "Play in" : "Sit out"} pattern ${activePattern + 1}`}
            onClick={() => togglePartMute(id)}
          >
            {sitsOut ? <LuVolumeX /> : <LuVolume2 />} {sitsOut ? "Sits out" : "Plays"}
          </Button>
          <Button
            size="xs"
            variant="subtle"
            rounded="sm"
            aria-label={`Random ${notes ? "notes" : "beat"} for pattern ${activePattern + 1}`}
            onClick={() => randomizePart(id)}
          >
            <LuDices /> {notes ? "Random notes" : "Random beat"}
          </Button>
        </HStack>
      </VStack>
      {/* The filter is the machine's, not the pattern's; it sits here because it is asked for here. */}
      <VStack gap="2" align="flex-start">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          Filter
        </Text>
        <HStack gap="2" wrap="wrap">
          <Button
            size="xs"
            variant="subtle"
            rounded="sm"
            aria-label="Random filter"
            onClick={() => {
              randomizeFilter(id)
              pushSound(id)
            }}
          >
            <LuDices /> Random
          </Button>
          <Button
            size="xs"
            variant="outline"
            rounded="sm"
            aria-label="Reset filter to factory"
            onClick={() => {
              resetFilter(id)
              pushSound(id)
            }}
          >
            <LuRotateCcw /> Reset
          </Button>
        </HStack>
      </VStack>
    </HStack>
  )
}
