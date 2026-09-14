import { chakra, useSlotRecipe } from "@chakra-ui/react"
import { useMemo } from "react"

import { useRackStore } from "../state/store"

/** Bars per row of the thumbnail; a full 128-bar song is eight rows, the height of a mini grid. */
const PER_ROW = 16
const GROUP = 4

/**
 * The chain for a folded SONG header: one LED per bar, sixteen to a row, on
 * the same little display as the mini grids. Every bar glows dimly; the one
 * sounding is lit. A song with no chain shows nothing.
 */
export function MiniSong() {
  const recipe = useSlotRecipe({ key: "miniGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  const chain = useRackStore((s) => s.chain)
  const playingBar = useRackStore((s) => s.playingBar)
  const followSong = useRackStore((s) => s.followSong)
  if (chain.length === 0) return null
  const sounding = followSong && playingBar >= 0 ? playingBar % chain.length : -1
  const rows = Array.from({ length: Math.ceil(chain.length / PER_ROW) }, (_, r) =>
    chain.slice(r * PER_ROW, (r + 1) * PER_ROW),
  )
  return (
    <chakra.div css={styles.root} role="img" aria-label={`Song: ${chain.length} bars`}>
      {rows.map((row, r) => (
        <chakra.div key={r} css={styles.row}>
          {Array.from({ length: Math.ceil(row.length / GROUP) }, (_, g) => (
            <chakra.div key={g} css={styles.beat}>
              {row.slice(g * GROUP, (g + 1) * GROUP).map((_, i) => {
                const bar = r * PER_ROW + g * GROUP + i
                return (
                  <chakra.span
                    key={bar}
                    css={styles.cell}
                    data-dim=""
                    data-on={bar === sounding ? "" : undefined}
                  />
                )
              })}
            </chakra.div>
          ))}
        </chakra.div>
      ))}
    </chakra.div>
  )
}
