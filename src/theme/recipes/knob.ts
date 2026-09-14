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
    // iOS: a long press must not pop the copy/share callout over a knob being turned.
    WebkitTouchCallout: "none",
    outline: "none",
    // A finger needs 44 px: the small knobs grow to that on touch screens, the others already are.
    "@media (pointer: coarse)": { minW: "11", minH: "11" },
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
    // Any focus, not only the keyboard's: a knob just turned stays marked, like the one under a hand.
    _focus: {
      outline: "2px solid",
      outlineColor: "rack.led.on",
      outlineOffset: "3px",
    },
    // While it is being turned, the pointer line lights up.
    "&[data-active]::before": { bg: "rack.led.on", shadow: "ledOn" },
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
