import { defineSlotRecipe } from "@chakra-ui/react"

/**
 * An LED level meter: a column of segments, lit from the bottom. Each segment
 * carries `data-zone` (green / yellow / red) and `data-lit` when the signal
 * reaches it — attributes, so a bouncing meter never allocates a class.
 */
export const meterRecipe = defineSlotRecipe({
  className: "meter",
  slots: ["root", "segment"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column-reverse",
      gap: "0.5",
      p: "1",
      rounded: "xs",
      bg: "rack.display.bg",
      borderWidth: "1px",
      borderColor: "rack.panel.edge",
      shadow: "display",
      width: "fit-content",
    },
    segment: {
      w: "3",
      h: "1.5",
      rounded: "xs",
      bg: "rack.meter.off",
      "&[data-zone=green][data-lit]": { bg: "rack.meter.green", shadow: "meterGreen" },
      "&[data-zone=yellow][data-lit]": { bg: "rack.meter.yellow", shadow: "meterYellow" },
      "&[data-zone=red][data-lit]": { bg: "rack.meter.red", shadow: "meterRed" },
    },
  },
  variants: {
    size: {
      sm: { segment: { w: "2.5", h: "1" } },
      md: {},
    },
    orientation: {
      vertical: {},
      // Lit from the left — for a folded header, where there is width but no height.
      horizontal: {
        root: { flexDirection: "row" },
        segment: { w: "1.5", h: "3" },
      },
    },
  },
  compoundVariants: [
    // The folded-header meter: a row of 3 px lit dots, the most compact the glow still reads at.
    {
      size: "sm",
      orientation: "horizontal",
      css: {
        root: { p: "0.5", px: "1", gap: "0.5" },
        segment: { w: "3px", h: "3px", rounded: "full" },
      },
    },
  ],
  defaultVariants: { size: "md", orientation: "vertical" },
})
