import { Box, Container, Flex, IconButton, VStack } from "@chakra-ui/react"
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
import { PinnedUnits } from "./PinnedUnits"
import { SongsButton, SongsPanel } from "./SongLibrary"
import { ToolbarPanel } from "./ToolbarPanel"
import { toolbarIconButton } from "./toolbar"

const FIXED: Record<FixedUnitId, ReactNode> = {
  "FX-2": <FxUnit />,
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
            {/* The toolbar as the first panel of the rack: songs at the left; add unit and fold-all at the right. */}
            <ToolbarPanel>
              <SongsButton />
              {/* Pushes the rest to the far side on a desktop; on a phone the buttons share the width. */}
              <Box flex="1" hideBelow="md" />
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
