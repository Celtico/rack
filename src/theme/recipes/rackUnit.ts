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
] as const
export type Finish = (typeof FINISHES)[number]

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
})

/**
 * One module in the rack: a metal panel with four corner screws, a silkscreen
 * header (model name + description + fold/mute controls) and a body that holds
 * the controls. Screw placement is keyed off `data-corner` so it stays in the
 * recipe.
 */
export const rackUnitRecipe = defineSlotRecipe({
  className: "rack-unit",
  slots: [
    "root",
    "header",
    "grip",
    "icon",
    "model",
    "title",
    "preview",
    "controls",
    "body",
    "screw",
  ],
  base: {
    root: {
      position: "relative",
      bg: "finish.graphite.panel",
      // Plain graphite with a soft glow of the finish colour falling from the top-left corner.
      bgImage:
        "radial-gradient(ellipse 40px 10px at 0px 0px, {colors.rack.panel} 0%, transparent 100px)",
      color: "rack.silkscreen",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      rounded: "sm",
      shadow: "panel",
      px: { base: "4", md: "6" },
      pt: "3",
      pb: "5",
      "&[data-folded]": { pb: "3" },
      "&[data-drop-target]": {
        outline: "2px dashed",
        outlineColor: "rack.led.on",
        outlineOffset: "2px",
      },
      "&[draggable=true]": { cursor: "grabbing", opacity: 0.85 },
    },
    grip: {
      display: "inline-flex",
      alignItems: "center",
      color: "rack.silkscreen.muted",
      cursor: "grab",
      touchAction: "none",
      rounded: "xs",
      _hover: { color: "rack.silkscreen" },
      _focusVisible: { outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "2px" },
    },
    preview: {
      display: "inline-flex",
      // Sits on the free side of the header, right before the controls.
      ml: "auto",
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
      mb: "4",
      mx: "4",
      "[data-folded] &": { borderBottomWidth: "0", pb: "0", mb: "0" },
    },
    icon: {
      display: "inline-flex",
      alignItems: "center",
      color: "rack.silkscreen",
      fontSize: "2xl",
      opacity: 0.9,
    },
    model: {
      textStyle: "silkscreen",
      fontWeight: "bold",
      fontSize: "sm",
      color: "rack.silkscreen",
    },
    title: {
      textStyle: "silkscreen",
      color: "rack.silkscreen.muted",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: "1",
      ml: "auto",
      flexShrink: 0,
      color: "rack.silkscreen.muted",
      // Only when a preview sits before them does it take the free space instead.
      "[data-part=preview] + &": { ml: "0" },
    },
    body: {
      mx: "4",
    },
    screw: {
      position: "absolute",
      boxSize: "3",
      rounded: "full",
      bg: "rack.screw",
      shadow: "screw",
      pointerEvents: "none",
      _before: {
        content: '""',
        position: "absolute",
        inset: "0",
        m: "auto",
        w: "70%",
        h: "1px",
        bg: "rack.panel.edge",
        rotate: "45deg",
      },
      "&[data-corner=tl]": { top: "2", left: "2" },
      "&[data-corner=tr]": { top: "2", right: "2" },
      "&[data-corner=bl]": { bottom: "2", left: "2" },
      "&[data-corner=br]": { bottom: "2", right: "2" },
    },
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
