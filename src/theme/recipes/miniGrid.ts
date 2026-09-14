import { defineSlotRecipe } from "@chakra-ui/react"

/**
 * A thumbnail of a 16-step pattern for a folded unit's header, drawn as an
 * LED matrix on a small dark display: one 3 px dot per step, rows stacked,
 * beats set slightly apart, the dots that are on lit amber, and one
 * translucent bar laid over the column that is sounding. Sizes are fixed
 * (cell 3px, gap 2px, beat gap 4px, padding 4px) because `MiniGrid` places the
 * playhead by arithmetic on them.
 *   cell[data-dim]    → holds something (a bank slot with a pattern, a bar of the song)
 *   cell[data-active] → the bank slot on screen
 *   cell[data-on]     → step is on / slot or bar sounding
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
      // The same little display the meters sit in.
      p: "1",
      rounded: "xs",
      bg: "rack.display.bg",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      shadow: "display",
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
      w: "3px",
      h: "3px",
      rounded: "full",
      bg: "rack.meter.off",
      "&[data-dim]": { bg: "rack.led.off" },
      "&[data-active]": { boxShadow: "0 0 0 1px {colors.rack.silkscreen.muted}" },
      "&[data-on]": { bg: "rack.led.on", shadow: "stepOn" },
    },
    playhead: {
      position: "absolute",
      top: "1",
      bottom: "1",
      w: "3px",
      rounded: "full",
      bg: "rack.silkscreen",
      opacity: 0.45,
      pointerEvents: "none",
    },
  },
})
