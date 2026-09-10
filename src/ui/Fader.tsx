import { Slider, Text, VStack } from "@chakra-ui/react"

export interface FaderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

const formatPercent = (v: number) => `${Math.round(v * 100)}%`

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
      <Slider.Control h="24">
        <Slider.Track bg="rack.display.bg" borderWidth="1px" borderColor="rack.panel.edge">
          <Slider.Range bg="rack.display.dim" />
        </Slider.Track>
        <Slider.Thumb
          index={0}
          boxSize="4"
          rounded="xs"
          bg="rack.knob.body"
          borderWidth="1px"
          borderColor="rack.knob.edge"
          shadow="knob"
          _focusVisible={{
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
