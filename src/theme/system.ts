import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

import { displayRecipe } from "./recipes/display"
import { knobRecipe } from "./recipes/knob"
import { ledRecipe } from "./recipes/led"
import { miniGridRecipe } from "./recipes/miniGrid"
import { meterRecipe } from "./recipes/meter"
import { rackUnitRecipe } from "./recipes/rackUnit"
import { stepGridRecipe } from "./recipes/stepGrid"
import { timelineRecipe } from "./recipes/timeline"

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
      // Keep the edge-to-edge phone layout clear of notches in landscape.
      paddingInlineStart: "env(safe-area-inset-left)",
      paddingInlineEnd: "env(safe-area-inset-right)",
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
        /** LED meter segments and alternative LCD backlights. */
        led: {
          green: { value: "#4fd865" },
          yellow: { value: "#ffd23a" },
          red: { value: "#ff4a3d" },
          off: { value: "#1e2422" },
        },
        lcd: {
          red: { value: "#ff5a4a" },
          green: { value: "#6fe38a" },
          blue: { value: "#6ec3ff" },
        },
        /** One colour per bank slot, for the timeline blocks. */
        pattern: {
          1: { value: "#e69a00" },
          2: { value: "#2e9a92" },
          3: { value: "#8b5cc9" },
          4: { value: "#5f9e3b" },
          // Slots 5–8 sit halfway between the hues of 1–4, and 9–16 halfway between those.
          5: { value: "#a2b635" },
          6: { value: "#35b659" },
          7: { value: "#355eb6" },
          8: { value: "#b6356f" },
          9: { value: "#b6aa35" },
          10: { value: "#83b635" },
          11: { value: "#3ab635" },
          12: { value: "#35b683" },
          13: { value: "#358eb6" },
          14: { value: "#3c35b6" },
          15: { value: "#b535b6" },
          16: { value: "#b64335" },
        },
        /** Unit finishes: panel colour, its darker edge, and the silkscreen inks that read on it. */
        finish: {
          graphite: {
            panel: { value: "#202022" },
            edge: { value: "#19191a" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          red: {
            panel: { value: "#7a1f1f" },
            edge: { value: "#390e0e" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          rust: {
            panel: { value: "#7a401f" },
            edge: { value: "#391e0e" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          teal: {
            panel: { value: "#1f7a6e" },
            edge: { value: "#0e3933" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          silver: {
            panel: { value: "#454b54" },
            edge: { value: "#202327" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          blue: {
            panel: { value: "#1f457a" },
            edge: { value: "#0e2039" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          purple: {
            panel: { value: "#541f7a" },
            edge: { value: "#270e39" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          cream: {
            panel: { value: "#675a32" },
            edge: { value: "#302a17" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          wood: {
            panel: { value: "#7a491f" },
            edge: { value: "#39220e" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          yellow: {
            panel: { value: "#7a681f" },
            edge: { value: "#39310e" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          green: {
            panel: { value: "#2a7a1f" },
            edge: { value: "#13390e" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
          },
          pink: {
            panel: { value: "#7a1f5e" },
            edge: { value: "#390e2c" },
            ink: { value: "#d4d2cc" },
            inkMuted: { value: "#a5a39e" },
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
        meterGreen: { value: "0 0 4px {colors.led.green}" },
        meterYellow: { value: "0 0 4px {colors.led.yellow}" },
        meterRed: { value: "0 0 5px {colors.led.red}" },
      },
    },
    semanticTokens: {
      colors: {
        rack: {
          rail: { value: "{colors.metal.950}" },
          frame: { value: "{colors.metal.900}" },
          panel: {
            DEFAULT: { value: "{colors.metal.900}" },
            edge: { value: "{colors.metal.900}" },
            /** A hairline between rows and sections on a panel — a shade up from it, so it shows. */
            divider: { value: "{colors.metal.700}" },
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
          pattern: {
            1: { value: "{colors.pattern.1}" },
            2: { value: "{colors.pattern.2}" },
            3: { value: "{colors.pattern.3}" },
            4: { value: "{colors.pattern.4}" },
            5: { value: "{colors.pattern.5}" },
            6: { value: "{colors.pattern.6}" },
            7: { value: "{colors.pattern.7}" },
            8: { value: "{colors.pattern.8}" },
            9: { value: "{colors.pattern.9}" },
            10: { value: "{colors.pattern.10}" },
            11: { value: "{colors.pattern.11}" },
            12: { value: "{colors.pattern.12}" },
            13: { value: "{colors.pattern.13}" },
            14: { value: "{colors.pattern.14}" },
            15: { value: "{colors.pattern.15}" },
            16: { value: "{colors.pattern.16}" },
          },
          meter: {
            green: { value: "{colors.led.green}" },
            yellow: { value: "{colors.led.yellow}" },
            red: { value: "{colors.led.red}" },
            off: { value: "{colors.led.off}" },
          },
          lcd: {
            red: { value: "{colors.lcd.red}" },
            green: { value: "{colors.lcd.green}" },
            blue: { value: "{colors.lcd.blue}" },
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
      meter: meterRecipe,
      miniGrid: miniGridRecipe,
      // Not `timeline`: Chakra ships a Timeline component whose slot recipe owns that key.
      songTimeline: timelineRecipe,
    },
  },
})

export const system = createSystem(defaultConfig, config)
