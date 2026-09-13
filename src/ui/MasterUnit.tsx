import { LuTimer } from "react-icons/lu"

import { RackUnit } from "./RackUnit"
import { Transport } from "./Transport"

/**
 * The top panel: the transport, always there. It folds from its own header
 * (fold key `CLOCK`, so Fold all / Unfold all include it) but has no grip and
 * cannot be moved or removed. The bank and the song sit under it as
 * `PinnedUnits`, sticky.
 */
export function MasterUnit() {
  return (
    <RackUnit id="CLOCK" model="TRANSPORT" title="Clock" icon={<LuTimer />} pinned>
      <Transport />
    </RackUnit>
  )
}
