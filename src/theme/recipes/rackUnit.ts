import { defineSlotRecipe } from "@chakra-ui/react"

export const FINISHES = [
  "graphite",
  "red",
  "rust",
  "teal",
  "silver",
  "blue",
  "purple",
  "cream",
  "wood",
  "yellow",
  "green",
  "pink",
  "cyan",
] as const
export type Finish = (typeof FINISHES)[number]

/** The finish colour lifted to a bright accent that reads on the dark panel — the header icon, the menu icon. */
export const finishAccent = (name: Finish) =>
  `oklch(from {colors.finish.${name}.panel} 0.74 calc(c * 2.4) h)`

/**
 * A finish repaints the `rack.panel` / `rack.silkscreen` tokens for everything
 * inside the unit by overriding their CSS variables on the root, so grids,
 * labels and borders follow without knowing which panel they sit on.
 */
const finish = (name: Finish) => ({
  root: {
    "--chakra-colors-rack-panel": `{colors.finish.${name}.panel}`,
    "--chakra-colors-rack-panel-edge": `{colors.finish.${name}.edge}`,
    "--chakra-colors-rack-silkscreen": `{colors.finish.${name}.ink}`,
    "--chakra-colors-rack-silkscreen-muted": `{colors.finish.${name}.inkMuted}`,
  },
  icon: { color: finishAccent(name) },
})

/**
 * One module in the rack: a plain metal panel, a silkscreen header (model name
 * + description + fold/mute controls) and a body that holds the controls. No
 * screws: the panels butt against each other.
 */
export const rackUnitRecipe = defineSlotRecipe({
  className: "rack-unit",
  slots: ["root", "header", "grip", "icon", "model", "title", "preview", "controls", "body"],
  base: {
    root: {
      position: "relative",
      bg: "finish.graphite.panel",
      // Plain graphite with a soft glow of the finish colour falling from the top-left corner.
      bgImage:
        "radial-gradient(ellipse 15px 10px at calc(100% + 500px) 10%, {colors.rack.panel} 0, transparent 800px)",
      color: "rack.silkscreen",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      // On a phone the panel runs edge to edge: square, tight margins.
      rounded: { base: "none", md: "sm" },
      shadow: "panel",
      px: "4",
      pt: { base: "2", md: "3" },
      pb: { base: "3", md: "5" },
      "&[data-folded]": { pb: { base: "2", md: "3" } },
      "&[data-drop-target]": {
        outline: "2px dashed",
        outlineColor: "rack.led.on",
        outlineOffset: "2px",
      },
      "&[draggable=true]": { cursor: "grabbing", opacity: 0.85 },
      // Silenced by another unit's solo: the nameplate and the thumbnail fade, the buttons stay bright.
      "&[data-silenced]": {
        "& [data-part=nameplate], & [data-part=preview]": { opacity: 0.4 },
      },
    },
    grip: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rack.silkscreen.muted",
      cursor: "grab",
      touchAction: "none",
      rounded: "xs",
      // A finger needs more than the glyph to hit.
      "@media (pointer: coarse)": { minW: "8", minH: "8" },
      _hover: { color: "rack.silkscreen" },
      _focusVisible: { outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "2px" },
    },
    preview: {
      display: "inline-flex",
      alignItems: "center",
      gap: "3",
      // On a phone right after the nameplate, on the left; on a desktop on the free side, by the controls.
      ml: { base: "0", md: "auto" },
      mr: "2",
      minW: "0",
      overflow: "hidden",
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: "3",
      borderBottomWidth: "1px",
      borderColor: "rack.panel.edge",
      pb: "2",
      mb: { base: "3", md: "4" },
      "[data-folded] &": { borderBottomWidth: "0", pb: "0", mb: "0" },
      // Any point of the header folds the unit (see `foldOnClick`).
      "&[data-foldable]": { cursor: "pointer", userSelect: "none" },
    },
    icon: {
      display: "inline-flex",
      alignItems: "center",
      // The finish variant paints it in the unit's accent colour.
      color: "rack.silkscreen",
      fontSize: "xl",
    },
    model: {
      textStyle: "silkscreen",
      fontWeight: "bold",
      fontSize: "xs",
      color: "rack.silkscreen",
      // "FX-2" must not break into two lines on a phone.
      whiteSpace: "nowrap",
      // A folded unit on a phone is its icon and its thumbnail: no text at all (the panel keeps its
      // accessible name on the section).
      "[data-folded] &": { display: { base: "none", md: "block" } },
    },
    title: {
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
      // On a phone the model name is enough; the description would wrap under it.
      hideBelow: "sm",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "1",
      ml: "auto",
      flexShrink: 0,
      color: "rack.silkscreen.muted",
      // The header's icon buttons are `xs`; on a touch screen they get a finger-sized box.
      "@media (pointer: coarse)": { "& > button": { minW: "8", minH: "8" } },
      // On a desktop the preview before them takes the free space instead.
      "[data-part=preview] + &": { ml: { base: "auto", md: "0" } },
    },
    body: {},
  },
  variants: {
    units: {
      1: { root: { minH: "28", "&[data-folded]": { minH: "0" } } },
      2: { root: { minH: "52", "&[data-folded]": { minH: "0" } } },
      3: { root: { minH: "76", "&[data-folded]": { minH: "0" } } },
    },
    finish: Object.fromEntries(FINISHES.map((name) => [name, finish(name)])) as Record<
      Finish,
      ReturnType<typeof finish>
    >,
  },
  defaultVariants: { units: 1, finish: "graphite" },
})
