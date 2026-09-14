import { HStack } from "@chakra-ui/react"
import { LuTimer } from "react-icons/lu"

import { LevelMeter } from "./LevelMeter"
import { RackUnit } from "./RackUnit"
import { RunButton } from "./RunButton"
import { Transport } from "./Transport"

/**
 * The top panel: the transport. It folds from its own header (fold key
 * `CLOCK`, so Fold all / Unfold all include it), is never moved, and its grip
 * menu can take it out of the rack (back from "Add unit → Put back"). The bank
 * and the song sit under it as `PinnedUnits`.
 */
export function MasterUnit() {
  return (
    <RackUnit
      id="CLOCK"
      model="TRANSPORT"
      title="Clock"
      icon={<LuTimer />}
      pinned
      // Folded, the transport keeps its run switch and shows what leaves the rack: the OUT meter, small.
      preview={
        <HStack gap="3">
          <LevelMeter source="master" label="Master level" size="sm" orientation="horizontal" />
          <RunButton size="xs" />
        </HStack>
      }
    >
      <Transport />
    </RackUnit>
  )
}
