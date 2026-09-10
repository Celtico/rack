import { defineRecipe } from "@chakra-ui/react"

/**
 * Rotary knob. The pointer line is a `::before` pseudo-element rotated by the
 * `--knob-angle` CSS variable, which the component sets inline — the only value
 * that is computed per render. Everything else lives here.
 */
export const knobRecipe = defineRecipe({
  className: "knob",
  base: {
    position: "relative",
    flexShrink: 0,
    rounded: "full",
    bg: "rack.knob.body",
    borderWidth: "1px",
    borderColor: "rack.knob.edge",
    shadow: "knob",
    cursor: "ns-resize",
    touchAction: "none",
    userSelect: "none",
    outline: "none",
    _before: {
      content: '""',
      position: "absolute",
      left: "50%",
      top: "8%",
      width: "2px",
      height: "42%",
      ml: "-1px",
      rounded: "full",
      bg: "rack.knob.indicator",
      transformOrigin: "50% 100%",
      transform: "rotate(var(--knob-angle, 0deg))",
    },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "rack.led.on",
      outlineOffset: "3px",
    },
  },
  variants: {
    size: {
      sm: { boxSize: "8" },
      md: { boxSize: "12" },
      lg: { boxSize: "16" },
    },
  },
  defaultVariants: { size: "md" },
})
