import { defineSlotRecipe } from "@chakra-ui/react"

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
      gridTemplateColumns: "max-content repeat(16, minmax(1.25rem, 2.25rem))",
      // Spare width stays at the end; otherwise the label track would stretch to take it.
      justifyContent: "start",
      columnGap: "1",
      rowGap: "1.5",
      alignItems: "center",
      width: "full",
    },
    row: {
      display: "contents",
    },
    label: {
      position: "sticky",
      left: "0",
      zIndex: "1",
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
      bg: "rack.panel",
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
      "&[data-accent]:not(:first-of-type)": { ml: "1.5" },
      "&[aria-pressed=true]": { bg: "rack.step.on", shadow: "stepOn" },
      "&[data-playing]": { borderColor: "rack.step.playing", shadow: "stepPlaying" },
      "&[data-playing][aria-pressed=true]": { bg: "rack.step.playing" },
    },
  },
})
