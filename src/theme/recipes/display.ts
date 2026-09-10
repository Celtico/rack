import { defineRecipe } from "@chakra-ui/react"

/** LCD-style readout. `tone` picks the backlight colour. */
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
    tone: {
      amber: {},
      red: { color: "rack.lcd.red" },
      green: { color: "rack.lcd.green" },
      blue: { color: "rack.lcd.blue" },
    },
  },
  defaultVariants: { size: "md", tone: "amber" },
})
