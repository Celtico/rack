import { defineRecipe } from "@chakra-ui/react"

/**
 * The wooden side cheeks of the rack, with a column of rack-rail holes every
 * 44px (one rack unit). Pure decoration; the grain is a couple of gradients.
 */
export const railRecipe = defineRecipe({
  className: "rail",
  base: {
    flexShrink: 0,
    w: { base: "3", md: "7" },
    rounded: "sm",
    shadow: "panel",
    bgImage: [
      // rail holes, one per rack unit
      "radial-gradient(circle at 50% 50%, #0c0b09 2px, #3a3d40 2.5px, transparent 3.5px)",
      // grain
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 4px)",
      // the plank
      "linear-gradient(90deg, #5a3a1f, #7a4e2c 35%, #8a5a33 55%, #5c3b21)",
    ].join(", "),
    backgroundSize: "100% 44px, 100% 100%, 100% 100%",
    backgroundPosition: "center 22px, 0 0, 0 0",
    backgroundRepeat: "repeat-y, repeat, no-repeat",
  },
})
