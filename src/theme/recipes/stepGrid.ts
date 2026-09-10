import { defineSlotRecipe } from "@chakra-ui/react"

/** Four cell tracks — one beat. */
const BEAT = "repeat(4, minmax(1.25rem, 2.25rem))"

/**
 * 16-step grid: a scrollable viewport with one row per voice. State is carried
 * on attributes so a running playhead never allocates new classes:
 *   step[aria-pressed=true]  → step is on
 *   step[data-accent]        → first step of each beat
 *   step[data-playing]       → the column currently sounding
 */
export const stepGridRecipe = defineSlotRecipe({
  className: "step-grid",
  slots: ["root", "grid", "row", "label", "step"],
  base: {
    root: {
      // Takes what is left next to a unit's controls and scrolls inside — never pushes them off.
      flex: "1 1 auto",
      minW: "0",
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      // When focus scrolls a column into view, keep it clear of the sticky labels.
      scrollPaddingInlineStart: "16",
      // Keep the focus ring of the last column visible inside the scroller.
      py: "1",
      px: "1",
      mx: "-1",
    },
    grid: {
      display: "grid",
      // Cells grow to 36px on a wide rack and shrink to 20px before the grid resorts to scrolling.
      // A narrow gutter track sits between each beat of four; StepGrid places cells past it.
      gridTemplateColumns: `max-content ${BEAT} 0.5rem ${BEAT} 0.5rem ${BEAT} 0.5rem ${BEAT}`,
      // Spare width stays at the end; otherwise the label track would stretch to take it.
      justifyContent: "start",
      columnGap: "2",
      rowGap: "2.5",
      alignItems: "center",
      width: "full",
    },
    row: {
      display: "contents",
    },
    label: {
      gridColumn: "1",
      position: "sticky",
      left: "0",
      zIndex: "1",
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
      // No flat fill (the panel is a gradient); cells scrolling underneath are blurred out instead.
      backdropFilter: "blur(6px)",
      pr: "3",
      minW: "12",
      whiteSpace: "nowrap",
    },
    step: {
      w: "full",
      aspectRatio: "1",
      rounded: "xs",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      bg: "rack.step.off",
      cursor: "pointer",
      touchAction: "manipulation",
      transitionProperty: "background-color, box-shadow, border-color",
      transitionDuration: "fast",
      _motionReduce: { transition: "none" },
      _hover: { borderColor: "rack.screw" },
      _focusVisible: {
        outline: "2px solid",
        outlineColor: "rack.led.on",
        outlineOffset: "1px",
      },
      "&[data-accent]": { bg: "rack.step.accent" },
      "&[aria-pressed=true]": { bg: "rack.step.on", shadow: "stepOn" },
      "&[data-playing]": { borderColor: "rack.step.playing", shadow: "stepPlaying" },
      "&[data-playing][aria-pressed=true]": { bg: "rack.step.playing" },
    },
  },
})
