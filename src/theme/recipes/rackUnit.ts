import { defineSlotRecipe } from "@chakra-ui/react"

/**
 * One module in the rack: a metal panel with four corner screws, a silkscreen
 * header (model name + description) and a body that holds the controls.
 * Screw placement is keyed off `data-corner` so it stays in the recipe.
 */
export const rackUnitRecipe = defineSlotRecipe({
  className: "rack-unit",
  slots: ["root", "header", "model", "title", "body", "screw"],
  base: {
    root: {
      position: "relative",
      bg: "rack.panel",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      rounded: "sm",
      shadow: "panel",
      px: { base: "4", md: "6" },
      pt: "3",
      pb: "5",
    },
    header: {
      display: "flex",
      alignItems: "baseline",
      gap: "3",
      borderBottomWidth: "1px",
      borderColor: "rack.panel.edge",
      pb: "2",
      mb: "4",
      mx: "4",
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
      1: { root: { minH: "28" } },
      2: { root: { minH: "52" } },
      3: { root: { minH: "76" } },
    },
  },
  defaultVariants: { units: 1 },
})
