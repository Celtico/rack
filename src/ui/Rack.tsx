import { Box, chakra, Container, Flex, IconButton, VStack } from "@chakra-ui/react"
import { useEffect, type ReactNode } from "react"
import { LuChevronsDownUp, LuChevronsUpDown } from "react-icons/lu"

import {
  FIXED_UNITS,
  isFixedUnit,
  PINNED_UNITS,
  TRANSPORT_UNIT,
  useLayoutStore,
  type FixedUnitId,
} from "../state/layout"
import { MASTER_SECTIONS, useRackStore } from "../state/store"
import { AddUnitButton, AddUnitPanel } from "./AddUnitDrawer"
import { DemoShelf } from "./DemoShelf"
import { FxUnit } from "./FxUnit"
import { InstanceUnit } from "./InstanceUnit"
import { MasterUnit } from "./MasterUnit"
import { usePanelStore } from "./panels"
import { PinnedUnits } from "./PinnedUnits"
import { SongsButton, SongsPanel } from "./SongLibrary"
import { useSongTitle } from "./songTitle"
import { ToolbarPanel } from "./ToolbarPanel"
import { toolbarIconButton } from "./toolbar"
import { UndoRedoButtons } from "./UndoRedoButtons"

const FIXED: Record<FixedUnitId, ReactNode> = {
  "FX-2": <FxUnit />,
}

/**
 * The name of the song the rack holds, printed on the toolbar like a silkscreen
 * legend — or "Select a song" on an empty rack. Pressing it opens the Songs panel.
 */
function SongTitle() {
  const title = useSongTitle()
  const open = usePanelStore((s) => s.panel === "songs")
  const { toggle } = usePanelStore.getState()
  return (
    <chakra.button
      type="button"
      aria-label={`Song: ${title}. Open the songs panel`}
      aria-expanded={open}
      title={title}
      textStyle="silkscreen"
      color="rack.silkscreen"
      textTransform="uppercase"
      letterSpacing="wider"
      maxW="full"
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      cursor="pointer"
      rounded="sm"
      px="2"
      py="1"
      _hover={{ bg: "whiteAlpha.50" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "1px" }}
      onClick={() => toggle("songs")}
    >
      {title}
    </chakra.button>
  )
}

/** The rack itself: a toolbar panel, then the units in the user's order. */
export function Rack() {
  const instances = useRackStore((s) => s.instances)
  const order = useLayoutStore((s) => s.order)
  const hidden = useLayoutStore((s) => s.hidden)
  const folded = useRackStore((s) => s.folded)
  const { syncUnits } = useLayoutStore.getState()
  const { setFolded } = useRackStore.getState()

  // Keep the layout's order in step with the instances that exist.
  const ids = [...FIXED_UNITS, ...instances.map((i) => i.id)]
  useEffect(() => {
    syncUnits(ids)
    // ids is derived from instances; re-sync only when the set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")])

  const visible = order.filter((id) =>
    isFixedUnit(id) ? !hidden.includes(id) : instances.some((i) => i.id === id),
  )
  const kindOf = new Map(instances.map((i) => [i.id, i.kind]))
  // One toggle: fold everything while anything is open, unfold everything once it is all folded.
  const foldable = [...MASTER_SECTIONS.filter((id) => !hidden.includes(id)), ...visible]
  const allFolded = foldable.every((id) => folded[id] === true)
  // Nothing at all on the rack — a first visit, or everything taken out: the demos take the floor.
  const empty =
    visible.length === 0 &&
    hidden.includes(TRANSPORT_UNIT) &&
    PINNED_UNITS.every((id) => hidden.includes(id))

  return (
    // On a desktop an open side panel docks to the right and the rack narrows to make room.
    <Flex align="flex-start">
      <Container
        as="main"
        maxW="8xl"
        flex="1"
        minW="0"
        px={{ base: "0", md: "6" }}
        py={{ base: "0", md: "8" }}
      >
        {/* The wooden rails and frame are a desktop thing; a phone shows the panels edge to edge. */}
        <Box
          bg="rack.frame"
          borderXWidth={{ base: "0", md: "10px" }}
          borderColor="rack.rail"
          rounded={{ base: "none", md: "md" }}
          p={{ base: "0", md: "3" }}
          shadow={{ base: "none", md: "panel" }}
        >
          <VStack gap={{ base: "1", md: "3" }} align="stretch">
            {/* The toolbar as the first panel of the rack: the rack's mark at the left, every button at the right. */}
            <ToolbarPanel>
              <chakra.img
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt="RACK"
                boxSize="8"
                rounded="sm"
                flexShrink={0}
              />
              {/* Which build this is: the commit count, small, by the mark; the hash on hover. */}
              <chakra.span
                textStyle="silkscreen"
                fontSize="2xs"
                color="rack.silkscreen.muted"
                flexShrink={0}
                // Down at the mark's baseline, like a footnote to it.
                alignSelf="flex-end"
                lineHeight="1"
                mb="0.5"
                title={__RACK_COMMIT__ ? `commit ${__RACK_COMMIT__}` : undefined}
              >
                v{__RACK_VERSION__}
              </chakra.span>
              <UndoRedoButtons />
              {/* The song's name on a readout in the middle, which also pushes the buttons to the far
                  side on a desktop; on a phone there is no room for it and the buttons share the width. */}
              <Box flex="1" hideBelow="md" minW="0" display="flex" justifyContent="center" px="3">
                <SongTitle />
              </Box>
              <SongsButton />
              <AddUnitButton />
              <IconButton
                {...toolbarIconButton}
                aria-label={allFolded ? "Unfold all" : "Fold all"}
                aria-pressed={allFolded}
                onClick={() => setFolded(foldable, !allFolded)}
              >
                {allFolded ? <LuChevronsUpDown /> : <LuChevronsDownUp />}
              </IconButton>
            </ToolbarPanel>
            {empty && <DemoShelf />}
            {!hidden.includes(TRANSPORT_UNIT) && <MasterUnit />}
            <PinnedUnits />
            {visible.map((id) => (
              <Box key={id}>
                {isFixedUnit(id) ? FIXED[id] : <InstanceUnit id={id} kind={kindOf.get(id)!} />}
              </Box>
            ))}
          </VStack>
        </Box>
      </Container>
      <AddUnitPanel />
      <SongsPanel />
    </Flex>
  )
}
