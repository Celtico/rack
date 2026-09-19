import { Button, HStack } from "@chakra-ui/react"
import { LuDices, LuRotateCcw, LuVolume2, LuVolumeX } from "react-icons/lu"

import { isMutedIn, type Kind } from "../state/pattern"
import { selectPattern, useRackStore } from "../state/store"
import { pushSound } from "./unitMeta"
import { ControlGroup } from "./ControlGroup"

const MELODIC: readonly Kind[] = ["synth", "bass", "poly", "ep", "strings"]

/**
 * What acts on the part in the grid (the pattern on screen): sit it out, or a
 * random one. `heading` off when a card around it already says which pattern.
 */
export function PatternTools({
  id,
  kind,
  heading = true,
}: {
  id: string
  kind: Kind
  heading?: boolean
}) {
  const activePattern = useRackStore((s) => s.activePattern)
  const sitsOut = useRackStore((s) => isMutedIn(selectPattern(s), id))
  const { randomizePart, togglePartMute } = useRackStore.getState()
  const notes = MELODIC.includes(kind)
  return (
    <ControlGroup title={heading ? `Pattern ${activePattern + 1}` : undefined}>
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
          <LuDices /> Random
        </Button>
      </HStack>
    </ControlGroup>
  )
}

/** Random / Reset for the machine's filter — its own, or the strip's. `heading` off inside a Filter card. */
export function FilterTools({ id, heading = true }: { id: string; heading?: boolean }) {
  const { randomizeFilter, resetFilter } = useRackStore.getState()
  return (
    <ControlGroup title={heading ? "Filter" : undefined}>
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
    </ControlGroup>
  )
}

/**
 * Both, side by side, at the end of a unit's controls: the pattern's tools and
 * the filter's (the filter is the machine's, not the pattern's; it sits here
 * because it is asked for here). A unit laid out in cards places them itself.
 */
export function PartTools({ id, kind }: { id: string; kind: Kind }) {
  return (
    <HStack gap="6" wrap="wrap" align="flex-start">
      <PatternTools id={id} kind={kind} />
      <FilterTools id={id} />
    </HStack>
  )
}
