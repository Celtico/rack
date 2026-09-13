import { Button, chakra, HStack, useSlotRecipe, VStack } from "@chakra-ui/react"
import { useMemo } from "react"
import { LuArrowRight, LuCopy, LuPlay, LuRepeat } from "react-icons/lu"

import { isPatternEmpty } from "../state/pattern"
import { PATTERN_COUNT } from "../state/patterns"
import { useRackStore } from "../state/store"
import { startTransport } from "./transportControl"

const SLOTS = Array.from({ length: PATTERN_COUNT }, (_, i) => i)

/** The timeline's mini block, grown just enough to carry a slot number. */
const MINI_SLOT = {
  w: "6",
  h: "6",
  display: "grid",
  placeItems: "center",
  textStyle: "display",
  fontSize: "xs",
  color: "rack.display.fg",
} as const

/** Bank of patterns, with the copy of the active one to the next slot. Files live on the toolbar. */
export function PatternBank() {
  const activePattern = useRackStore((s) => s.activePattern)
  const playingPattern = useRackStore((s) => s.playingPattern)
  const patterns = useRackStore((s) => s.patterns)
  const playing = useRackStore((s) => s.playing)
  const followSong = useRackStore((s) => s.followSong)
  const hasSong = useRackStore((s) => s.chain.length > 0)
  const { setActivePattern, copyActivePatternTo, setFollowSong } = useRackStore.getState()

  // Like SONG's "Play song": while the clock is stopped, start it looping the active slot.
  const playPattern = () => {
    setFollowSong(false)
    void startTransport()
  }
  // Slots with nothing in them show a faded number, so the used ones stand out.
  const empty = useMemo(() => patterns.map(isPatternEmpty), [patterns])
  // Same blocks as the SONG bars: grey, lit in the pattern's colour while it sounds.
  const styles = useSlotRecipe({ key: "songTimeline" })()
  const next = (activePattern + 1) % PATTERN_COUNT

  return (
    <VStack gap="3" align="stretch" minW="0">
      {/* Two rows of eight — no scrolling; one row on a wide rack. Slots fill their column on a phone. */}
      <chakra.div
        role="group"
        aria-label="Pattern bank"
        display="grid"
        // Equal columns that share the whole width: no spare space at the end of the row.
        gridTemplateColumns={{
          base: "repeat(8, minmax(0, 1fr))",
          xl: `repeat(${PATTERN_COUNT}, minmax(0, 1fr))`,
        }}
        gap="1"
        py="1"
      >
        {SLOTS.map((slot) => (
          <chakra.button
            key={slot}
            type="button"
            css={[styles.block, { w: "full", minW: "0" }]}
            data-pattern={slot + 1}
            data-playing={slot === playingPattern ? "" : undefined}
            data-active={slot === activePattern ? "" : undefined}
            data-empty={empty[slot] ? "" : undefined}
            aria-pressed={slot === activePattern}
            aria-label={`Edit pattern ${slot + 1}`}
            onClick={() => setActivePattern(slot)}
          >
            <chakra.span css={styles.number}>{slot + 1}</chakra.span>
          </chakra.button>
        ))}
      </chakra.div>
      {/* Under the slots: play the active slot while stopped, and one small button that draws the copy. */}
      <HStack justify="center" gap="3">
        {!playing && (
          <Button
            size="2xs"
            rounded="sm"
            variant="solid"
            colorPalette="orange"
            onClick={playPattern}
            aria-label={`Play pattern ${activePattern + 1}`}
          >
            <LuPlay /> Play
          </Button>
        )}
        {/* Picking a slot pauses the song on that slot; this hands the clock back to the chain (same as SONG). */}
        {playing && hasSong && !followSong && (
          <Button
            size="2xs"
            rounded="sm"
            variant="solid"
            colorPalette="orange"
            onClick={() => setFollowSong(true)}
            aria-label="Resume the song"
          >
            <LuRepeat /> Song
          </Button>
        )}
        <Button
          size="sm"
          rounded="sm"
          variant="outline"
          px="2"
          gap="2"
          onClick={() => copyActivePatternTo(next)}
          aria-label={`Copy pattern ${activePattern + 1} to slot ${next + 1}`}
        >
          <chakra.span css={[styles.miniBlock, MINI_SLOT]} data-active="" aria-hidden="true">
            {activePattern + 1}
          </chakra.span>
          <LuCopy />
          <LuArrowRight />
          <chakra.span css={[styles.miniBlock, MINI_SLOT]} aria-hidden="true">
            {next + 1}
          </chakra.span>
        </Button>
      </HStack>
    </VStack>
  )
}
