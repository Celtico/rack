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
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      // Keep the focus ring of the last column visible inside the scroller.
      py: "1",
      px: "1",
      mx: "-1",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "auto repeat(16, max-content)",
      columnGap: "1",
      rowGap: "1.5",
      alignItems: "center",
      width: "max-content",
      minW: "full",
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
    },
    step: {
      boxSize: "7",
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
