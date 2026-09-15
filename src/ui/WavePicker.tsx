import { chakra, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import type { Waveform } from "../state/params"
import { WAVE_LABELS } from "./unitMeta"

/** One cycle of each waveform, drawn in a 24×12 box with the current colour. */
const WAVE_PATHS: Readonly<Record<Waveform, string>> = {
  sawtooth: "M1 11 L12 1 L12 11 L23 1",
  square: "M1 11 V1 H12 V11 H23 V1",
  triangle: "M1 11 L7 1 L18 11 L23 3",
  sine: "M1 6 C4 -1 8 -1 12 6 S20 13 23 6",
}

/** The shape of a waveform, as a small line drawing. */
export function WaveGlyph({ wave }: { wave: Waveform }) {
  return (
    <chakra.svg viewBox="0 0 24 12" w="6" h="3" aria-hidden="true" display="block">
      <path
        d={WAVE_PATHS[wave]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </chakra.svg>
  )
}

/**
 * The oscillator's waveform as a row of drawn shapes: the same segmented
 * control every synth shows, with a picture instead of "Saw" / "Sqr".
 */
export function WavePicker<W extends Waveform>({
  value,
  options,
  onChange,
  label = "Wave",
}: {
  value: W
  options: readonly W[]
  onChange: (wave: W) => void
  /** The silkscreen over it: "Wave" on a synth, "Shape" on an LFO. */
  label?: string
}) {
  return (
    <VStack gap="2" align="flex-start">
      <Text textStyle="silkscreen" color="rack.silkscreen.muted">
        {label}
      </Text>
      <SegmentGroup.Root
        size="sm"
        value={value}
        onValueChange={(details) => {
          if (options.includes(details.value as W)) onChange(details.value as W)
        }}
      >
        <SegmentGroup.Indicator />
        {options.map((wave) => (
          <SegmentGroup.Item key={wave} value={wave} aria-label={WAVE_LABELS[wave]}>
            <SegmentGroup.ItemText title={WAVE_LABELS[wave]}>
              <WaveGlyph wave={wave} />
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    </VStack>
  )
}
