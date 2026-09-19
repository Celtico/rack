import { Slider, Text, VStack } from "@chakra-ui/react"
import { formatPercent } from "./format"

export interface FaderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

/** Touch screens: a taller, thicker fader with a wide invisible strip to land a finger on. */
const COARSE = "@media (pointer: coarse)"

/** A vertical channel fader, 0–1. Chakra's Slider carries the keyboard and ARIA. */
export function Fader({ label, value, onChange }: FaderProps) {
  return (
    <Slider.Root
      orientation="vertical"
      min={0}
      max={1}
      step={0.01}
      value={[value]}
      onValueChange={(details) => {
        const next = details.value[0]
        if (next !== undefined) onChange(next)
      }}
      size="sm"
      colorPalette="orange"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="1"
    >
      <Slider.Control h="24" px="3" css={{ [COARSE]: { h: "32", px: "5" } }}>
        {/* A wide slot and a wide cap: a channel fader, not a hairline. */}
        <Slider.Track
          bg="rack.display.bg"
          borderWidth="1px"
          borderColor="rack.panel.edge"
          w="2.5"
          css={{ [COARSE]: { w: "3" } }}
        >
          <Slider.Range bg="rack.display.dim" />
        </Slider.Track>
        <Slider.Thumb
          index={0}
          w="8"
          h="5"
          css={{ [COARSE]: { w: "9", h: "6" } }}
          rounded="xs"
          bg="rack.knob.body"
          borderWidth="1px"
          borderColor="rack.knob.edge"
          shadow="knob"
          // Any focus: a fader just moved stays marked, like the knobs.
          _focus={{
            outline: "2px solid",
            outlineColor: "rack.led.on",
            outlineOffset: "2px",
          }}
        >
          <Slider.HiddenInput />
        </Slider.Thumb>
      </Slider.Control>
      <VStack gap="0" align="center">
        <Slider.Label textStyle="silkscreen" color="rack.silkscreen.muted">
          {label}
        </Slider.Label>
        <Text textStyle="display" fontSize="xs" color="rack.display.fg">
          {formatPercent(value)}
        </Text>
      </VStack>
    </Slider.Root>
  )
}
