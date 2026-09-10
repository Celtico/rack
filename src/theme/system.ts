import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

import { displayRecipe } from "./recipes/display"
import { knobRecipe } from "./recipes/knob"
import { ledRecipe } from "./recipes/led"
import { rackUnitRecipe } from "./recipes/rackUnit"
import { stepGridRecipe } from "./recipes/stepGrid"

/**
 * The rack look: dark metallic panels, amber displays, small light silkscreen.
 * Raw palettes live in `tokens`; components only ever see the `rack.*` semantic
 * tokens below, so the palette can change without touching a component.
 */
const config = defineConfig({
  globalCss: {
    html: { colorScheme: "dark" },
    body: {
      bg: "rack.rail",
      color: "rack.silkscreen",
      minH: "100dvh",
      fontFamily: "silkscreen",
    },
    // iOS Safari zooms the viewport when a focused field is under 16px.
    "input, select, textarea": { fontSize: "16px" },
  },
  theme: {
    tokens: {
      colors: {
        metal: {
          950: { value: "#111214" },
          900: { value: "#18191b" },
          800: { value: "#1f2123" },
          700: { value: "#2c2e30" },
          600: { value: "#3a3d40" },
          500: { value: "#55585c" },
          400: { value: "#75797e" },
        },
        amber: {
          300: { value: "#ffd27a" },
          400: { value: "#ffb000" },
          500: { value: "#e69a00" },
          600: { value: "#b87800" },
          900: { value: "#3a2600" },
        },
        cream: {
          100: { value: "#f3efe4" },
          200: { value: "#d8d4c8" },
          300: { value: "#a9a59a" },
        },
        ink: {
          900: { value: "#0c0b09" },
        },
        /** Unit finishes: panel colour, its darker edge, and the silkscreen inks that read on it. */
        finish: {
          graphite: {
            panel: { value: "#2c2e30" },
            edge: { value: "#18191b" },
            ink: { value: "#d8d4c8" },
            inkMuted: { value: "#a9a59a" },
          },
          red: {
            panel: { value: "#5a2323" },
            edge: { value: "#2e1010" },
            ink: { value: "#f3dede" },
            inkMuted: { value: "#d0a8a8" },
          },
          rust: {
            panel: { value: "#5b3720" },
            edge: { value: "#2e1a0e" },
            ink: { value: "#f3e6da" },
            inkMuted: { value: "#d2b8a2" },
          },
          teal: {
            panel: { value: "#1f4a48" },
            edge: { value: "#0e2624" },
            ink: { value: "#dcefed" },
            inkMuted: { value: "#a3c6c2" },
          },
          silver: {
            panel: { value: "#9a9ea3" },
            edge: { value: "#5c6066" },
            ink: { value: "#16181a" },
            inkMuted: { value: "#3a3e44" },
          },
          blue: {
            panel: { value: "#22354f" },
            edge: { value: "#101a2a" },
            ink: { value: "#dfe7f3" },
            inkMuted: { value: "#a9b7cc" },
          },
          purple: {
            panel: { value: "#3b2a52" },
            edge: { value: "#1d1329" },
            ink: { value: "#ebe2f5" },
            inkMuted: { value: "#bfb0d2" },
          },
          cream: {
            panel: { value: "#d9d0b8" },
            edge: { value: "#8c8368" },
            ink: { value: "#1c1a15" },
            inkMuted: { value: "#4c473a" },
          },
          wood: {
            panel: { value: "#5b3d26" },
            edge: { value: "#2f1e11" },
            ink: { value: "#f2e6d6" },
            inkMuted: { value: "#cdb89f" },
          },
          yellow: {
            panel: { value: "#c29a22" },
            edge: { value: "#6e5510" },
            ink: { value: "#1c1804" },
            inkMuted: { value: "#4a3f10" },
          },
        },
      },
      fonts: {
        display: { value: `"SF Mono", ui-monospace, Menlo, Consolas, monospace` },
        silkscreen: { value: `"Helvetica Neue", Inter, system-ui, sans-serif` },
      },
      shadows: {
        panel: {
          value: "inset 0 1px 0 {colors.metal.500}, 0 2px 8px rgba(0, 0, 0, 0.6)",
        },
        screw: {
          value: "inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 1px 1px rgba(0, 0, 0, 0.7)",
        },
        knob: {
          value:
            "inset 0 1px 0 {colors.metal.400}, inset 0 -2px 3px rgba(0, 0, 0, 0.5), 0 3px 6px rgba(0, 0, 0, 0.6)",
        },
        display: {
          value: "inset 0 1px 4px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(0, 0, 0, 0.6)",
        },
        ledOn: {
          value: "0 0 6px {colors.amber.400}, 0 0 2px {colors.amber.300}",
        },
        stepOn: {
          value: "inset 0 0 4px rgba(0, 0, 0, 0.4), 0 0 6px {colors.amber.600}",
        },
        stepPlaying: {
          value: "0 0 0 1px {colors.amber.300}",
        },
      },
    },
    semanticTokens: {
      colors: {
        rack: {
          rail: { value: "{colors.metal.950}" },
          frame: { value: "{colors.metal.900}" },
          panel: {
            DEFAULT: { value: "{colors.metal.700}" },
            edge: { value: "{colors.metal.900}" },
          },
          screw: { value: "{colors.metal.500}" },
          silkscreen: {
            DEFAULT: { value: "{colors.cream.200}" },
            muted: { value: "{colors.cream.300}" },
          },
          display: {
            bg: { value: "{colors.ink.900}" },
            fg: { value: "{colors.amber.400}" },
            dim: { value: "{colors.amber.600}" },
          },
          led: {
            on: { value: "{colors.amber.400}" },
            off: { value: "{colors.amber.900}" },
          },
          step: {
            on: { value: "{colors.amber.500}" },
            off: { value: "{colors.metal.600}" },
            accent: { value: "{colors.metal.500}" },
            playing: { value: "{colors.amber.300}" },
          },
          knob: {
            body: { value: "{colors.metal.600}" },
            edge: { value: "{colors.metal.900}" },
            indicator: { value: "{colors.cream.100}" },
          },
        },
      },
    },
    textStyles: {
      silkscreen: {
        value: {
          fontFamily: "silkscreen",
          fontSize: "xs",
          textTransform: "uppercase",
          letterSpacing: "wider",
          lineHeight: "shorter",
        },
      },
      display: {
        value: {
          fontFamily: "display",
          fontWeight: "medium",
          letterSpacing: "wide",
          lineHeight: "none",
        },
      },
    },
    recipes: {
      knob: knobRecipe,
      display: displayRecipe,
      led: ledRecipe,
    },
    slotRecipes: {
      rackUnit: rackUnitRecipe,
      stepGrid: stepGridRecipe,
    },
  },
})

export const system = createSystem(defaultConfig, config)
