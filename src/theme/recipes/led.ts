import { defineRecipe } from "@chakra-ui/react"

/** Panel LED. `on` is a boolean variant. */
export const ledRecipe = defineRecipe({
  className: "led",
  base: {
    display: "inline-block",
    boxSize: "2.5",
    rounded: "full",
    borderWidth: "1px",
    borderColor: "rack.panel.edge",
    transitionProperty: "background-color, box-shadow",
    transitionDuration: "fast",
    _motionReduce: { transition: "none" },
  },
  variants: {
    on: {
      true: { bg: "rack.led.on", shadow: "ledOn" },
      false: { bg: "rack.led.off" },
    },
  },
  defaultVariants: { on: false },
})
