import { defineSlotRecipe } from "@chakra-ui/react"

/** Four cell tracks — one beat. Cells shrink to 20px before the grid scrolls… */
const BEAT = "repeat(4, minmax(1.25rem, 2.25rem))"
/** …but never under 28px for a finger: a touch screen scrolls sooner instead. */
const BEAT_COARSE = "repeat(4, minmax(1.75rem, 2.25rem))"
/** A row's `--tint` (a panel finish) lifted to a bright accent, as `finishAccent` does for a header icon. */
export const TINT_ACCENT = "oklch(from var(--tint) 0.74 calc(c * 2.4) h)"

const columns = (beat: string) => `max-content ${beat} 0.5rem ${beat} 0.5rem ${beat} 0.5rem ${beat}`

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
      // Painting with a drag must not select the labels along the way.
      userSelect: "none",
      // As wide as its cells and no more, scrolling inside when short of room: the unit's controls
      // flow right after it instead of being pushed to the far edge of the panel.
      flex: "0 1 auto",
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
      gridTemplateColumns: columns(BEAT),
      "@media (pointer: coarse)": { gridTemplateColumns: columns(BEAT_COARSE) },
      // Spare width stays at the end; otherwise the label track would stretch to take it.
      justifyContent: "start",
      columnGap: "2",
      rowGap: "2.5",
      alignItems: "center",
      width: "full",
      // Room for the labels' vertical bleed (below), so it never becomes a scrollbar.
      py: "2.5",
    },
    row: {
      display: "contents",
    },
    label: {
      gridColumn: "1",
      position: "sticky",
      // The scroller pads 4 px for focus rings; the band sticks past that padding, at the very edge,
      // so no cell scrolls into view on its left.
      left: "-1",
      ml: "-1",
      zIndex: "1",
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
      // A band of the units' graphite (what every panel is painted with, under its tint glow) under the
      // text, fading out to the right: cells scrolling underneath disappear behind it instead of showing
      // through, and it is invisible when nothing scrolls. (A backdrop blur did this before.)
      bgImage:
        "linear-gradient(to right, {colors.finish.graphite.panel} 0, {colors.finish.graphite.panel} 70%, transparent 100%)",
      // Air on both sides of the text: the band starts at the panel's edge, the word does not.
      pl: "3",
      pr: "4",
      minW: "12",
      whiteSpace: "nowrap",
      // The whole row's height, plus the row gap above and below (more than half: a lit cell's glow
      // reaches past its box): one unbroken band from the top of the grid to the bottom, nothing
      // peeping through between or past the labels while the grid scrolls.
      alignSelf: "stretch",
      display: "inline-flex",
      alignItems: "center",
      // Between a row's pictogram (when it has one) and its name.
      gap: "1.5",
      my: "-2.5",
      py: "2.5",
      // A selectable label (the bank's machines): the selected one is lit and outlined, like a knob
      // just turned; Delete then takes the machine out.
      "&[data-row-label]": { cursor: "pointer", rounded: "xs", outlineOffset: "-2px" },
      "&[data-row-label]:focus-visible": { outline: "1px dashed", outlineColor: "rack.led.on" },
      "&[data-selected]": {
        color: "rack.silkscreen",
        outline: "2px solid",
        outlineColor: "rack.led.on",
      },
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
      // Only the toggle fades. The playhead changes border and shadow on two cells per row
      // every step; animating those repainted the grid for several frames each step.
      transitionProperty: "background-color",
      transitionDuration: "fast",
      _motionReduce: { transition: "none" },
      _hover: { borderColor: "rack.screw" },
      _focusVisible: {
        outline: "2px solid",
        outlineColor: "rack.led.on",
        outlineOffset: "1px",
      },
      "&[data-accent]": { bg: "rack.step.accent" },
      // A marked cell prints its row's pictogram in the middle (the bank's matrix: this part has
      // notes in this pattern), in the row's accent — dimmed while the cell is off.
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      p: "0",
      "& > svg": { w: "52%", h: "52%", pointerEvents: "none" },
      "&[data-marked]": { color: "whiteAlpha.600" },
      "&[data-tinted][data-marked]": { color: TINT_ACCENT },
      "&[aria-pressed=true]": { bg: "rack.step.on", shadow: "stepOn" },
      "&[data-playing]": { borderColor: "rack.step.playing", shadow: "stepPlaying" },
      "&[data-playing][aria-pressed=true]": { bg: "rack.step.playing" },
      // A tinted row (the bank's matrix) is not a sequencer: every cell keeps the plain grey of an
      // unlit cell — the icon in its colour says which machine has notes there — and one where the
      // machine sits the slot out is the same at 30 % opacity. (Amber, a finish-coloured paint, a
      // faded dashed cell and a crossed speaker were tried and dropped.)
      "&[data-tinted][aria-pressed=true]": { bg: "rack.step.off", shadow: "none" },
      "&[data-tinted]:not([aria-pressed=true])": { opacity: 0.3 },
      "&[data-tinted][data-playing]": { bg: "rack.step.accent" },
      // Drag and drop between cells: a marked cell can be picked up, the cell under it is outlined.
      "&[draggable=true]": { cursor: "grab" },
      "&[data-drop-target]": {
        outline: "2px dashed",
        outlineColor: "rack.led.on",
        outlineOffset: "1px",
      },
    },
  },
})
