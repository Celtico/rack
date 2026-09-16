import { Button, chakra, HStack, useSlotRecipe, VStack } from "@chakra-ui/react"
import { useMemo, useState, type DragEvent, type ReactNode } from "react"
import { LuPlay, LuRepeat } from "react-icons/lu"

import { instanceLabel } from "../state/instances"
import { isMutedIn, isPatternEmpty, isTrackEmpty } from "../state/pattern"
import { useRackStore, type RackState } from "../state/store"
import { StepGrid, type CellDrag } from "./StepGrid"
import { startTransport } from "./transportControl"
import { KIND_FINISH, kindIcon } from "./unitMeta"

const slotPlayhead = (s: RackState) => s.playingPattern

/** A bank slot being dragged: the slot number. */
const PATTERN_DRAG = "application/x-rack-pattern"
/** A part being dragged from the matrix: `<instance id>:<slot>`. */
const PART_DRAG = "application/x-rack-part"

const partData = (id: string, slot: number) => `${id}:${slot}`
const parsePart = (data: string): { id: string; slot: number } | null => {
  const at = data.lastIndexOf(":")
  if (at < 0) return null
  const slot = Number(data.slice(at + 1))
  return Number.isInteger(slot) ? { id: data.slice(0, at), slot } : null
}

/** Put the part a drag carries into `slot` of machine `id` (the same machine unless dropped on another row). */
function dropPart(data: string, id: string, slot: number): void {
  const part = parsePart(data)
  if (!part || (part.id === id && part.slot === slot)) return
  const state = useRackStore.getState()
  const track = state.patterns[part.slot]?.tracks[part.id]
  if (track) state.setTrack(id, slot, track)
}

/**
 * Who plays in which slot: one row per machine, one column per pattern, lit
 * where the part sounds. The same grid as the sequencers, so a click flips
 * cells, and the sounding slot's column lights up. A part with notes can be
 * dragged onto another column (a copy) — or onto a slot button above.
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
        // The machine's mark and colour, as on its own header and in FX-2: in the label, and inside
        // every cell where the part has notes, so an empty slot reads as empty.
        icon: kindIcon(inst.kind),
        tint: `{colors.finish.${KIND_FINISH[inst.kind]}.panel}`,
        steps: patterns.map((p) => !isMutedIn(p, inst.id)),
        marks: patterns.map((p) => {
          const track = p.tracks[inst.id]
          return track !== undefined && !isTrackEmpty(track)
        }),
      })),
    [instances, patterns],
  )
  const drag = useMemo<CellDrag<string>>(
    () => ({
      type: PART_DRAG,
      dataOf: partData,
      accepts: [PART_DRAG],
      onDrop: (id, slot, e) => dropPart(e.dataTransfer.getData(PART_DRAG), id, slot),
    }),
    [],
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
        drag={drag}
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
  const { setActivePattern, setFollowSong, swapPatterns, copyPattern } = useRackStore.getState()

  // Like SONG's "Play song": while the clock is stopped, start it looping the active slot.
  const playPattern = () => {
    setFollowSong(false)
    void startTransport()
  }
  // Slots with nothing in them show a faded number, so the used ones stand out.
  const empty = useMemo(() => patterns.map(isPatternEmpty), [patterns])
  // Same blocks as the SONG bars: grey, lit in the pattern's colour while it sounds.
  const styles = useSlotRecipe({ key: "songTimeline" })()

  // Drag a slot onto another to swap them (⌥ copies instead); a part from the matrix lands in the slot.
  const [over, setOver] = useState<number | null>(null)
  const onDragStart = (slot: number) => (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(PATTERN_DRAG, String(slot))
    e.dataTransfer.effectAllowed = "copyMove"
  }
  const onDragOver = (slot: number) => (e: DragEvent<HTMLButtonElement>) => {
    const { types } = e.dataTransfer
    if (types.includes(PATTERN_DRAG)) e.dataTransfer.dropEffect = e.altKey ? "copy" : "move"
    else if (types.includes(PART_DRAG)) e.dataTransfer.dropEffect = "copy"
    else return
    e.preventDefault()
    setOver(slot)
  }
  const onDrop = (slot: number) => (e: DragEvent<HTMLButtonElement>) => {
    setOver(null)
    const pattern = e.dataTransfer.getData(PATTERN_DRAG)
    const part = e.dataTransfer.getData(PART_DRAG)
    if (pattern) {
      e.preventDefault()
      const from = Number(pattern)
      if (e.altKey) copyPattern(from, slot)
      else swapPatterns(from, slot)
    } else if (part) {
      e.preventDefault()
      const source = parsePart(part)
      if (source) dropPart(part, source.id, slot)
    }
  }

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
              data-drop-target={slot === over ? "" : undefined}
              aria-pressed={slot === activePattern}
              aria-label={`Edit pattern ${slot + 1}`}
              onClick={() => setActivePattern(slot)}
              draggable
              onDragStart={onDragStart(slot)}
              onDragOver={onDragOver(slot)}
              onDragLeave={() => setOver((o) => (o === slot ? null : o))}
              onDrop={onDrop(slot)}
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
