import { defineSlotRecipe } from "@chakra-ui/react"

/**
 * A thumbnail of a 16-step pattern for a folded unit's header: one dot per
 * step, rows stacked, beats set slightly apart, and one translucent bar laid
 * over the column that is sounding. Sizes are fixed (cell 4px, gap 2px, beat
 * gap 4px) because `MiniGrid` places the playhead by arithmetic on them.
 *   cell[data-playing] is gone — the playhead is its own element.
 *   cell[data-on]      → step is on
 */
export const miniGridRecipe = defineSlotRecipe({
  className: "mini-grid",
  slots: ["root", "row", "beat", "cell", "playhead"],
  base: {
    root: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: "0.5",
      flexShrink: 0,
    },
    row: {
      display: "flex",
      gap: "1",
    },
    beat: {
      display: "flex",
      gap: "0.5",
    },
    cell: {
      w: "1",
      h: "1",
      rounded: "1px",
      bg: "rack.step.off",
      "&[data-on]": { bg: "rack.step.on" },
    },
    playhead: {
      position: "absolute",
      top: "0",
      bottom: "0",
      w: "1",
      rounded: "1px",
      bg: "rack.silkscreen",
      opacity: 0.45,
      pointerEvents: "none",
    },
  },
})
