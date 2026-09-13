import { Box, Container, HStack, IconButton, VStack } from "@chakra-ui/react"
import { useEffect, type ReactNode } from "react"
import { LuChevronsDownUp, LuChevronsUpDown } from "react-icons/lu"

import { FIXED_UNITS, isFixedUnit, useLayoutStore, type FixedUnitId } from "../state/layout"
import { MASTER_SECTIONS, useRackStore } from "../state/store"
import { AddUnitDrawer } from "./AddUnitDrawer"
import { FxUnit } from "./FxUnit"
import { InstanceUnit } from "./InstanceUnit"
import { LoadSongButton } from "./LoadSongButton"
import { MasterUnit } from "./MasterUnit"
import { PinnedUnits } from "./PinnedUnits"
import { SongLibrary } from "./SongLibrary"
import { toolbarIconButton } from "./toolbar"

const FIXED: Record<FixedUnitId, ReactNode> = {
  "FX-2": <FxUnit />,
}

/** The rack itself: the units in the user's order, with a small toolbar above. */
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
  const foldable = [...MASTER_SECTIONS, ...visible]
  const allFolded = foldable.every((id) => folded[id] === true)

  return (
    <Container as="main" maxW="8xl" px={{ base: "0", md: "6" }} py={{ base: "0", md: "8" }}>
      {/* Fold-all toggle, then songs, file and units. On a phone the strip runs edge to edge. */}
      <HStack
        gap={{ base: "0", md: "2" }}
        mb={{ base: "2", md: "3" }}
        // On a phone the strip is panel grey and reaches up under the status bar: 50px of it,
        // or the notch's own inset when that is taller. Padding, not margin, so nothing shows black.
        bg={{ base: "rack.toolbar", md: "transparent" }}
        pt={{ base: "max(50px, env(safe-area-inset-top))", md: "0" }}
        justify="flex-end"
      >
        <IconButton
          {...toolbarIconButton}
          aria-label={allFolded ? "Unfold all" : "Fold all"}
          aria-pressed={allFolded}
          onClick={() => setFolded(foldable, !allFolded)}
        >
          {allFolded ? <LuChevronsUpDown /> : <LuChevronsDownUp />}
        </IconButton>

        <LoadSongButton />
        <AddUnitDrawer />
        <SongLibrary />
      </HStack>

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
          <MasterUnit />
          <PinnedUnits />
          {visible.map((id) => (
            <Box key={id}>
              {isFixedUnit(id) ? FIXED[id] : <InstanceUnit id={id} kind={kindOf.get(id)!} />}
            </Box>
          ))}
        </VStack>
      </Box>
    </Container>
  )
}
