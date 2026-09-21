import { defineSlotRecipe } from "@chakra-ui/react"

/**
 * A guitar neck drawn as SVG: six strings, twelve frets, and one dot per grid
 * row at the fret where its note falls, the note's name printed in it and the
 * fret number beside it, as a tablature writes it. The dots are buttons:
 * pressed, they strike the note.
 *   dot[data-on]  → the note is in the column that is sounding
 *   dot[data-hit] → just struck by hand
 */
export const fretboardRecipe = defineSlotRecipe({
  className: "fretboard",
  slots: [
    "scroller",
    "root",
    "string",
    "fret",
    "nut",
    "marker",
    "place",
    "dot",
    "fretTag",
    "fretNumber",
    "stringName",
    "ghost",
    "tab",
  ],
  base: {
    // The neck is at most 40rem wide (full width looked oversized); short of `minW` it keeps its
    // size and scrolls sideways inside this box instead (a phone), like the step grids.
    scroller: {
      w: "full",
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      // Room for a focused dot's ring and the popover's arrow at the edges.
      py: "1",
    },
    root: {
      display: "block",
      w: "full",
      minW: "36rem",
      maxW: "40rem",
      h: "auto",
      userSelect: "none",
      overflow: "visible",
      touchAction: "manipulation",
    },
    string: { stroke: "metal.400", strokeWidth: "1" },
    fret: { stroke: "metal.600", strokeWidth: "1" },
    nut: { stroke: "rack.silkscreen.muted", strokeWidth: "3" },
    marker: { fill: "metal.700" },
    // An invisible press target per string and fret; a faint ring shows under the pointer.
    place: {
      fill: "transparent",
      cursor: "pointer",
      outline: "none",
      _hover: { fill: "whiteAlpha.100" },
    },
    // A dot is a group: the circle and the note's name on it.
    dot: {
      cursor: "pointer",
      outline: "none",
      "& circle": {
        fill: "rack.step.off",
        stroke: "rack.panel.edge",
        strokeWidth: "1",
        transitionProperty: "fill, stroke",
        transitionDuration: "fast",
        _motionReduce: { transition: "none" },
      },
      "& text[data-name]": {
        fill: "rack.silkscreen",
        fontSize: "9px",
        fontWeight: "semibold",
        fontFamily: "body",
        textAnchor: "middle",
        dominantBaseline: "central",
        pointerEvents: "none",
      },
      "&:hover circle": { stroke: "rack.screw" },
      "&:focus-visible circle": { stroke: "rack.led.on", strokeWidth: "2" },
      "&[data-on] circle, &[data-hit] circle": { fill: "rack.led.on" },
      "&[data-on] text[data-name], &[data-hit] text[data-name]": { fill: "blackAlpha.800" },
      // A mark the user put on the neck: outlined amber, so it reads apart from the key's rows.
      "&[data-mark] circle": { fill: "rack.led.off", stroke: "rack.led.on" },
      "&[data-mark] text[data-name]": { fill: "rack.display.fg" },
      "&[data-mark][data-hit] circle": { fill: "rack.led.on" },
      "&[data-mark][data-hit] text[data-name]": { fill: "blackAlpha.800" },
    },
    // The dot's fret number, small, at its top right: what a tab prints on that string's line.
    fretTag: {
      fill: "rack.display.fg",
      fontSize: "7px",
      fontWeight: "semibold",
      fontFamily: "mono",
      pointerEvents: "none",
    },
    fretNumber: {
      fill: "rack.silkscreen.muted",
      opacity: 0.55,
      fontSize: "8px",
      fontFamily: "body",
      textAnchor: "middle",
      "&[data-inlay]": { opacity: 1 },
    },
    // The note under the pointer, before it is pressed: a dashed, see-through dot with its name.
    ghost: {
      pointerEvents: "none",
      "& circle": {
        fill: "whiteAlpha.100",
        stroke: "rack.led.on",
        strokeWidth: "1",
        strokeDasharray: "3 2",
      },
      "& text": {
        fill: "rack.silkscreen",
        fontSize: "9px",
        fontWeight: "semibold",
        fontFamily: "body",
        textAnchor: "middle",
        dominantBaseline: "central",
      },
    },
    // "e B G D A E" at the left of the nut — the letters a tablature's lines carry.
    stringName: {
      fill: "rack.silkscreen",
      fontSize: "9px",
      fontWeight: "bold",
      fontFamily: "mono",
      dominantBaseline: "central",
    },
    // The marks printed as a tab, on the same dark readout as the displays; scrolls when long.
    tab: {
      m: 0,
      px: "3",
      py: "2",
      bg: "rack.display.bg",
      color: "rack.display.fg",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      rounded: "xs",
      shadow: "display",
      fontFamily: "mono",
      fontSize: "xs",
      lineHeight: "1.35",
      overflowX: "auto",
      overscrollBehaviorX: "contain",
      maxW: "40rem",
    },
  },
})
