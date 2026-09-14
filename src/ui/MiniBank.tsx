import { chakra, useSlotRecipe } from "@chakra-ui/react"
import { useMemo } from "react"

import { isPatternEmpty } from "../state/pattern"
import { useRackStore } from "../state/store"

const GROUPS = [0, 4, 8, 12]

/**
 * The bank for a folded BANK header: its 16 slots as one row of LEDs on the
 * same little display as the mini grids. A slot with something in it glows
 * dimly, the one on screen wears a ring, the one sounding is lit.
 */
export function MiniBank() {
  const recipe = useSlotRecipe({ key: "miniGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  const patterns = useRackStore((s) => s.patterns)
  const active = useRackStore((s) => s.activePattern)
  const playing = useRackStore((s) => s.playingPattern)
  return (
    <chakra.div css={styles.root} role="img" aria-label="Bank slots">
      <chakra.div css={styles.row}>
        {GROUPS.map((first) => (
          <chakra.div key={first} css={styles.beat}>
            {Array.from({ length: 4 }, (_, i) => {
              const slot = first + i
              const pattern = patterns[slot]
              return (
                <chakra.span
                  key={slot}
                  css={styles.cell}
                  data-dim={pattern && !isPatternEmpty(pattern) ? "" : undefined}
                  data-active={slot === active ? "" : undefined}
                  data-on={slot === playing ? "" : undefined}
                />
              )
            })}
          </chakra.div>
        ))}
      </chakra.div>
    </chakra.div>
  )
}
