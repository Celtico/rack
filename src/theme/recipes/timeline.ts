import { defineSlotRecipe } from "@chakra-ui/react"

import { PATTERN_COUNT } from "../../state/patterns"

/** Slots whose colour is light enough to want dark ink on top. */
const DARK_INK = new Set([1, 4, 5, 6, 9, 10, 11])
const SLOTS = Array.from({ length: PATTERN_COUNT }, (_, i) => i + 1)

/** A bar of the song (with its number above): narrower on a phone so more of the chain fits a row. */
const BAR_WIDTH = { base: "12", md: "16" }

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
    "bar",
    "block",
    "number",
    "progress",
    "remove",
    "play",
    "add",
    "ruler",
    "mini",
    "miniBlock",
    "section",
    "sectionHeader",
    "sectionName",
    "sectionMeta",
  ],
  base: {
    root: {
      py: "1",
      px: "1",
      mx: "-1",
      display: "flex",
      flexDirection: "column",
      gap: "2",
    },
    // A named run of bars: its header line, then its bars wrapping under it. A hairline between two.
    section: {
      display: "flex",
      flexDirection: "column",
      gap: "1.5",
      "& + &": { borderTopWidth: "1px", borderColor: "rack.panel.divider", pt: "2" },
    },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "2",
      minH: "8",
    },
    // The name: a plain word that turns into a field on click.
    sectionName: {
      textStyle: "silkscreen",
      fontWeight: "semibold",
      color: "rack.silkscreen",
      letterSpacing: "wider",
      textTransform: "uppercase",
      cursor: "text",
      rounded: "xs",
      px: "1",
      mx: "-1",
      _hover: { bg: "blackAlpha.300" },
      _focusVisible: { outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "1px" },
      // A bank slot dragged over the name: dropping it fills the section.
      "&[data-drop-target]": {
        outline: "2px dashed",
        outlineColor: "rack.led.on",
        outlineOffset: "1px",
      },
    },
    sectionMeta: {
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
    },
    // Bars wrap into rows, so a long song (up to `MAX_CHAIN`) is all on screen at once.
    track: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      gap: "1",
      rowGap: "2",
    },
    // One column: the bar number, then the block.
    bar: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      w: BAR_WIDTH,
      flexShrink: 0,
    },
    ruler: {
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
      textAlign: "center",
      lineHeight: "1",
    },
    block: {
      position: "relative",
      w: BAR_WIDTH,
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
      // The bank's slots drag: onto another slot to swap (⌥ copies), a part dropped on one lands there,
      // and a slot dropped on a song bar becomes that bar's pattern.
      "&[draggable=true]": { cursor: "grab" },
      // A song bar travelling along the timeline.
      "&[data-dragging]": { opacity: 0.4 },
      "&[data-drop-target]": {
        outline: "2px dashed",
        outlineColor: "rack.led.on",
        outlineOffset: "1px",
      },
    },
    number: {
      pointerEvents: "none",
      // A slot with nothing in it: the number goes grey, like a control that is off; the block stays.
      "[data-empty] &": { color: "rack.silkscreen.muted" },
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
    // Bottom-left: run the song from this bar.
    play: {
      position: "absolute",
      bottom: "0",
      left: "0",
      boxSize: "4",
      display: "grid",
      placeItems: "center",
      fontSize: "2xs",
      lineHeight: "1",
      color: "inherit",
      opacity: 0.6,
      _hover: { opacity: 1, color: "rack.led.on" },
      _focusVisible: { outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "-2px" },
    },
    add: {
      w: BAR_WIDTH,
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
      // A bank slot dragged over the +: dropping it appends a bar of it.
      "&[data-drop-target]": {
        outline: "2px dashed",
        outlineColor: "rack.led.on",
        outlineOffset: "1px",
      },
    },
  },
})
