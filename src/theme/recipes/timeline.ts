import { defineSlotRecipe } from "@chakra-ui/react"

import { PATTERN_COUNT } from "../../state/patterns"

/** Slots whose colour is light enough to want dark ink on top. */
const DARK_INK = new Set([1, 4, 5, 6, 9, 10, 11])
const SLOTS = Array.from({ length: PATTERN_COUNT }, (_, i) => i + 1)

/** `data-playing` + `data-pattern="n"` → the slot's colour (and, for blocks, a readable ink). */
const slotColours = (withInk: boolean) =>
  Object.fromEntries(
    SLOTS.map((n) => [
      `&[data-playing][data-pattern='${n}']`,
      withInk
        ? { bg: `rack.pattern.${n}`, color: DARK_INK.has(n) ? "ink.900" : "cream.100" }
        : { bg: `rack.pattern.${n}` },
    ]),
  )

/**
 * The song timeline: one grey block per bar of the chain; the bar being played
 * (`data-playing`) lights up in its bank slot's colour (`data-pattern="1".."16"`)
 * with a progress bar that fills across the 16 steps.
 */
export const timelineRecipe = defineSlotRecipe({
  className: "song-timeline",
  slots: [
    "root",
    "track",
    "block",
    "number",
    "progress",
    "remove",
    "add",
    "ruler",
    "mini",
    "miniBlock",
  ],
  base: {
    root: {
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      py: "1",
      px: "1",
      mx: "-1",
    },
    ruler: {
      display: "flex",
      gap: "1",
      mb: "1",
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
      "& > *": { w: "16", flexShrink: 0, textAlign: "center" },
    },
    track: {
      display: "flex",
      alignItems: "stretch",
      gap: "1",
      width: "max-content",
      minW: "full",
    },
    block: {
      position: "relative",
      w: "16",
      h: "12",
      flexShrink: 0,
      rounded: "sm",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      bg: "rack.step.off",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      textStyle: "display",
      fontSize: "lg",
      color: "rack.display.fg",
      transitionProperty: "box-shadow, border-color",
      transitionDuration: "fast",
      _motionReduce: { transition: "none" },
      _focusVisible: { outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "1px" },
      "&[data-playing]": { borderColor: "rack.step.playing", shadow: "stepPlaying" },
      ...slotColours(true),
      // The bank's slot being edited.
      "&[data-active]": { borderColor: "rack.led.on", boxShadow: "0 0 0 1px {colors.rack.led.on}" },
    },
    number: {
      pointerEvents: "none",
    },
    // The chain in miniature for the folded header: one small square per bar.
    mini: {
      display: "flex",
      gap: "0.5",
      flexShrink: 0,
    },
    miniBlock: {
      w: "3",
      h: "3",
      rounded: "xs",
      bg: "rack.step.off",
      "&[data-active]": { outline: "1px solid", outlineColor: "rack.led.on", outlineOffset: "1px" },
      "&[data-playing]": {
        outline: "1px solid",
        outlineColor: "rack.step.playing",
        outlineOffset: "1px",
      },
      ...slotColours(false),
    },
    progress: {
      position: "absolute",
      left: "0",
      bottom: "0",
      h: "1",
      bg: "cream.100",
      opacity: 0.85,
      pointerEvents: "none",
      transitionProperty: "width",
      transitionDuration: "fastest",
      _motionReduce: { transition: "none" },
    },
    remove: {
      position: "absolute",
      top: "0",
      right: "0",
      boxSize: "4",
      display: "grid",
      placeItems: "center",
      fontSize: "xs",
      lineHeight: "1",
      color: "inherit",
      opacity: 0.6,
      _hover: { opacity: 1 },
    },
    add: {
      w: "16",
      h: "12",
      flexShrink: 0,
      rounded: "sm",
      borderWidth: "1px",
      borderStyle: "dashed",
      borderColor: "rack.screw",
      color: "rack.silkscreen.muted",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      _hover: { borderColor: "rack.silkscreen", color: "rack.silkscreen" },
      _focusVisible: { outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "1px" },
    },
  },
})
