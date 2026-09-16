import { Button, chakra, HStack, useSlotRecipe, VStack } from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react"
import { LuPlay, LuRepeat } from "react-icons/lu"

import { instanceLabel } from "../state/instances"
import { isMutedIn, isPatternEmpty, isTrackEmpty } from "../state/pattern"
import { useRackStore, type RackState } from "../state/store"
import { ConfirmDialog } from "./ConfirmDialog"
import { PART_DRAG, PATTERN_DRAG, useClearOnDragEnd } from "./dragTypes"
import { removeInstanceWithUndo, scrollToUnit } from "./removeInstance"
import { StepGrid, type CellDrag } from "./StepGrid"
import { startTransport } from "./transportControl"
import { inTextField } from "./undoRedo"
import { KIND_FINISH, kindIcon } from "./unitMeta"

const slotPlayhead = (s: RackState) => s.playingPattern

/** "DR-4 #2" for an id, read off the store when a question is worded. */
const instanceLabelOf = (id: string): string => {
  const { instances } = useRackStore.getState()
  const inst = instances.find((i) => i.id === id)
  return inst ? instanceLabel(inst, instances) : id
}

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
 * A click on a machine's name in the matrix: the song pauses on the slot on screen (it keeps
 * looping, as picking a slot does), and the machine's panel unfolds and scrolls into view.
 */
function openInstrument(id: string): void {
  const state = useRackStore.getState()
  state.setFollowSong(false)
  state.setFolded([id], false)
  // The panel unfolds on the next render; scroll once it is there.
  requestAnimationFrame(() => scrollToUnit(id))
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
  // A click on a machine's name selects it; Delete / Backspace then takes it out of the rack (with the
  // Undo toast), Escape or a press anywhere else lets it go. A machine that left the rack is forgotten.
  const [selected, setSelected] = useState<string | null>(null)
  const selectedInstance = instances.find((i) => i.id === selected) ?? null
  useEffect(() => {
    if (!selectedInstance) return
    const onKey = (e: KeyboardEvent) => {
      if (inTextField(e.target)) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        setSelected(null)
        removeInstanceWithUndo(
          selectedInstance.id,
          instanceLabel(selectedInstance, useRackStore.getState().instances),
        )
      } else if (e.key === "Escape") setSelected(null)
    }
    const onPress = (e: PointerEvent) => {
      if (!(e.target instanceof Element && e.target.closest("[data-row-label]"))) setSelected(null)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPress)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPress)
    }
  }, [selectedInstance])
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
        // One click does both: the machine is selected (Delete takes it out) and its panel opens.
        onRowSelect={(id) => {
          setSelected(id)
          openInstrument(id)
        }}
        selectedRow={selectedInstance?.id ?? null}
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

  // A slot or a part dropped on the bank's own surface — not on a cell or a slot button — is asked
  // about, then emptied: the pattern's every part, or that one part.
  const [discard, setDiscard] = useState<
    { kind: "pattern"; slot: number } | { kind: "part"; id: string; slot: number } | null
  >(null)
  const [overSurface, setOverSurface] = useState(false)
  const clearSurface = useCallback(() => setOverSurface(false), [])
  useClearOnDragEnd(overSurface, clearSurface)
  const onSurfaceTarget = (target: EventTarget | null) =>
    !(target instanceof Element && target.closest("[data-step], [data-pattern]"))
  const onSurfaceDragOver = (e: DragEvent<HTMLDivElement>) => {
    const { types } = e.dataTransfer
    if (!types.includes(PATTERN_DRAG) && !types.includes(PART_DRAG)) return
    const onSurface = onSurfaceTarget(e.target)
    if (onSurface) {
      e.preventDefault()
      // The effect must be one the drag allows, or the browser drops the drop unheard: a part is
      // dragged as "copy" (from the matrix), a slot as "copyMove".
      e.dataTransfer.dropEffect = types.includes(PART_DRAG) ? "copy" : "move"
    }
    if (onSurface !== overSurface) setOverSurface(onSurface)
  }
  const onSurfaceDrop = (e: DragEvent<HTMLDivElement>) => {
    setOverSurface(false)
    if (!onSurfaceTarget(e.target)) return
    const pattern = e.dataTransfer.getData(PATTERN_DRAG)
    const part = e.dataTransfer.getData(PART_DRAG)
    if (pattern) {
      e.preventDefault()
      ask({ kind: "pattern", slot: Number(pattern) })
    } else if (part) {
      const source = parsePart(part)
      if (!source) return
      e.preventDefault()
      ask({ kind: "part", ...source })
    }
  }
  // The question opens once the drag is over (its `dragend`, and the pointer's release, come right
  // after the drop): a dialog that mounts inside the drop lands under that release.
  const ask = (what: NonNullable<typeof discard>) => {
    window.setTimeout(() => setDiscard(what), 100)
  }
  const answerDiscard = (yes: boolean) => {
    const what = discard
    setDiscard(null)
    if (!yes || !what) return
    const state = useRackStore.getState()
    if (what.kind === "pattern") state.clearPattern(what.slot)
    else state.clearParts(what.id)
  }
  const discardQuestion =
    discard === null
      ? null
      : discard.kind === "pattern"
        ? `Empty pattern ${discard.slot + 1}? Every machine's part in it goes. Undo brings it back.`
        : `Empty ${instanceLabelOf(discard.id)}'s part in every pattern? Its whole row goes. Undo brings it back.`
  // Same blocks as the SONG bars: grey, lit in the pattern's colour while it sounds.
  const styles = useSlotRecipe({ key: "songTimeline" })()

  // Drag a slot onto another to swap them (⌥ copies instead); a part from the matrix lands in the slot.
  const [over, setOver] = useState<number | null>(null)
  const clearOver = useCallback(() => setOver(null), [])
  useClearOnDragEnd(over !== null, clearOver)
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
      {/* The sixteen slots head the parts matrix below, one over each column. A slot or a part
          dropped on the box itself (not on a cell or a slot button) is asked about, then emptied. */}
      <chakra.div
        role="group"
        aria-label="Pattern bank"
        data-drop-target={overSurface ? "" : undefined}
        css={{
          "&[data-drop-target]": {
            outline: "2px dashed",
            outlineColor: "fg.error",
            outlineOffset: "4px",
            rounded: "sm",
          },
        }}
        onDragOver={onSurfaceDragOver}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null))
            setOverSurface(false)
        }}
        onDrop={onSurfaceDrop}
      >
        <PartsMatrix
          header={(slot) => (
            <chakra.button
              type="button"
              // A square on the cell's track (the timeline's block is a 48 px-tall bar), the plain grey
              // raised by a shadow, with a bold number — the slot being played still lights in its
              // pattern's colour.
              css={[
                styles.block,
                {
                  w: "full",
                  minW: "0",
                  h: "auto",
                  aspectRatio: "1",
                  fontWeight: "bold",
                  boxShadow:
                    "0 2px 4px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
                },
              ]}
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
      <ConfirmDialog
        open={discardQuestion}
        title="Drop to empty"
        action="Empty"
        onAnswer={answerDiscard}
      />
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
