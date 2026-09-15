import { Button, chakra, HStack, useSlotRecipe, VStack } from "@chakra-ui/react"
import { useMemo, type ReactNode } from "react"
import { LuPlay, LuRepeat } from "react-icons/lu"

import { instanceLabel } from "../state/instances"
import { isMutedIn, isPatternEmpty } from "../state/pattern"
import { useRackStore, type RackState } from "../state/store"
import { StepGrid } from "./StepGrid"
import { startTransport } from "./transportControl"

const slotPlayhead = (s: RackState) => s.playingPattern

/**
 * Who plays in which slot: one row per machine, one column per pattern, lit
 * where the part sounds. The same grid as the sequencers, so a click (or a
 * drag) flips cells, and the sounding slot's column lights up.
 */
function PartsMatrix({ header }: { header: (slot: number) => ReactNode }) {
  const instances = useRackStore((s) => s.instances)
  const patterns = useRackStore((s) => s.patterns)
  const { togglePartMute } = useRackStore.getState()
  const rows = useMemo(
    () =>
      instances.map((inst) => ({
        id: inst.id,
        label: instanceLabel(inst, instances),
        steps: patterns.map((p) => !isMutedIn(p, inst.id)),
      })),
    [instances, patterns],
  )
  return (
    <VStack gap="1" align="stretch">
      {rows.length > 0 && (
        <chakra.span textStyle="silkscreen" color="rack.silkscreen.muted">
          Who plays in each pattern
        </chakra.span>
      )}
      {/* The slot buttons head the matrix, one per column, so a pattern's number sits over its column. */}
      <StepGrid
        rows={rows}
        header={header}
        columnName="pattern"
        playheadOf={slotPlayhead}
        onToggle={(id, slot) => togglePartMute(id, slot)}
      />
    </VStack>
  )
}

/** Bank of patterns, with the copy of the active one to the next slot. Files live on the toolbar. */
export function PatternBank() {
  const activePattern = useRackStore((s) => s.activePattern)
  const playingPattern = useRackStore((s) => s.playingPattern)
  const patterns = useRackStore((s) => s.patterns)
  const playing = useRackStore((s) => s.playing)
  const followSong = useRackStore((s) => s.followSong)
  const hasSong = useRackStore((s) => s.chain.length > 0)
  const { setActivePattern, setFollowSong } = useRackStore.getState()

  // Like SONG's "Play song": while the clock is stopped, start it looping the active slot.
  const playPattern = () => {
    setFollowSong(false)
    void startTransport()
  }
  // Slots with nothing in them show a faded number, so the used ones stand out.
  const empty = useMemo(() => patterns.map(isPatternEmpty), [patterns])
  // Same blocks as the SONG bars: grey, lit in the pattern's colour while it sounds.
  const styles = useSlotRecipe({ key: "songTimeline" })()

  return (
    <VStack gap="3" align="stretch" minW="0">
      {/* The sixteen slots head the parts matrix below, one over each column. */}
      <chakra.div role="group" aria-label="Pattern bank">
        <PartsMatrix
          header={(slot) => (
            <chakra.button
              type="button"
              css={[styles.block, { w: "full", minW: "0", aspectRatio: "1" }]}
              data-pattern={slot + 1}
              data-playing={slot === playingPattern ? "" : undefined}
              data-active={slot === activePattern ? "" : undefined}
              data-empty={empty[slot] ? "" : undefined}
              aria-pressed={slot === activePattern}
              aria-label={`Edit pattern ${slot + 1}`}
              onClick={() => setActivePattern(slot)}
            >
              <chakra.span css={[styles.number, { fontSize: "2xs" }]}>{slot + 1}</chakra.span>
            </chakra.button>
          )}
        />
      </chakra.div>
      {/* Under the matrix: play the active slot while stopped, or hand the clock back to the song. */}
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
      </HStack>
    </VStack>
  )
}
