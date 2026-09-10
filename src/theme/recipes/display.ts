import { defineRecipe } from "@chakra-ui/react"

/** Amber LCD-style readout. */
export const displayRecipe = defineRecipe({
  className: "display",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    textStyle: "display",
    bg: "rack.display.bg",
    color: "rack.display.fg",
    borderWidth: "1px",
    borderColor: "rack.panel.edge",
    rounded: "xs",
    shadow: "display",
    px: "2",
    py: "1",
    minW: "14",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  variants: {
    size: {
      sm: { fontSize: "sm", minW: "12" },
      md: { fontSize: "lg", minW: "16" },
      lg: { fontSize: "2xl", minW: "24" },
    },
  },
  defaultVariants: { size: "md" },
})
