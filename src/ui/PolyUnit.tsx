import { Flex, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import { getEngine } from "../audio/engine"
import {
  POLY_PARAMS_DEFAULT,
  POLY_RANGES,
  useRackStore,
  WAVEFORMS,
  type PolyParams,
  type Waveform,
} from "../state/store"
import { Knob } from "./Knob"
import { PolyGrid } from "./PolyGrid"
import { RackUnit } from "./RackUnit"

const WAVE_LABELS: Record<Waveform, string> = {
  sawtooth: "Saw",
  square: "Sqr",
  triangle: "Tri",
  sine: "Sin",
}

const isWaveform = (v: string | null): v is Waveform => WAVEFORMS.includes(v as Waveform)

const formatHz = (v: number) => `${Math.round(v)} Hz`
const formatMs = (v: number) => (v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`)
const formatPercent = (v: number) => `${Math.round(v * 100)}%`

/** POLY-4: a subtractive pad with an ADSR and a lowpass. */
export function PolyUnit() {
  const params = useRackStore((s) => s.polyParams)
  const { setPolyParam } = useRackStore.getState()

  const change =
    <K extends keyof PolyParams>(key: K) =>
    (value: PolyParams[K]) => {
      setPolyParam(key, value)
      getEngine().setPolyParam(key, value)
    }

  return (
    <RackUnit model="POLY-4" title="Poly pad" units={3} finish="purple" channel="poly">
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <PolyGrid instrument="poly" />

        <VStack gap="4" align="flex-start" flexShrink={0}>
          <VStack gap="2" align="flex-start">
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Wave
            </Text>
            <SegmentGroup.Root
              size="sm"
              value={params.waveform}
              onValueChange={(details) => {
                if (isWaveform(details.value)) change("waveform")(details.value)
              }}
            >
              <SegmentGroup.Indicator />
              {WAVEFORMS.map((wave) => (
                <SegmentGroup.Item key={wave} value={wave}>
                  <SegmentGroup.ItemText>{WAVE_LABELS[wave]}</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
          </VStack>

          <HStack gap="4" wrap="wrap" align="flex-start" maxW={{ lg: "56" }}>
            <Knob
              label="Cutoff"
              scale="log"
              value={params.cutoff}
              min={POLY_RANGES.cutoff.min}
              max={POLY_RANGES.cutoff.max}
              step={1}
              defaultValue={POLY_PARAMS_DEFAULT.cutoff}
              format={formatHz}
              onChange={change("cutoff")}
            />
            <Knob
              label="Attack"
              scale="log"
              value={params.attack}
              min={POLY_RANGES.attack.min}
              max={POLY_RANGES.attack.max}
              step={0.001}
              defaultValue={POLY_PARAMS_DEFAULT.attack}
              format={formatMs}
              onChange={change("attack")}
            />
            <Knob
              label="Decay"
              scale="log"
              value={params.decay}
              min={POLY_RANGES.decay.min}
              max={POLY_RANGES.decay.max}
              step={0.01}
              defaultValue={POLY_PARAMS_DEFAULT.decay}
              format={formatMs}
              onChange={change("decay")}
            />
            <Knob
              label="Sustain"
              value={params.sustain}
              min={POLY_RANGES.sustain.min}
              max={POLY_RANGES.sustain.max}
              step={0.01}
              defaultValue={POLY_PARAMS_DEFAULT.sustain}
              format={formatPercent}
              onChange={change("sustain")}
            />
            <Knob
              label="Release"
              scale="log"
              value={params.release}
              min={POLY_RANGES.release.min}
              max={POLY_RANGES.release.max}
              step={0.01}
              defaultValue={POLY_PARAMS_DEFAULT.release}
              format={formatMs}
              onChange={change("release")}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
