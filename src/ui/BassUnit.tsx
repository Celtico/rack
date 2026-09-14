import { Flex, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import {
  BASS_PARAMS_DEFAULT,
  BASS_RANGES,
  BASS_WAVEFORMS,
  selectInstance,
  useRackStore,
  type BassWaveform,
} from "../state/store"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { BassGrid } from "./TrackGrids"
import {
  changeParams,
  formatHz,
  formatMs,
  formatPercent,
  formatQ,
  KIND_FINISH,
  kindIcon,
} from "./unitMeta"

const WAVE_LABELS: Record<BassWaveform, string> = { sawtooth: "Saw", square: "Sqr" }

const isWaveform = (v: string | null): v is BassWaveform =>
  BASS_WAVEFORMS.includes(v as BassWaveform)

/** BASS-2: acid mono line — one note per column, plus accent and slide per step. */
export function BassUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"bass"> | undefined
  const all = useRackStore((s) => s.instances)
  if (!inst) return null

  const params = inst.params

  return (
    <RackUnit
      id={id}
      model={instanceLabel(inst, all)}
      title={KIND_TITLE.bass}
      units={3}
      finish={KIND_FINISH.bass}
      icon={kindIcon("bass")}
      instance
    >
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <BassGrid id={id} />

        <VStack gap="4" align="flex-start" flexShrink={0}>
          <VStack gap="2" align="flex-start">
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Wave
            </Text>
            <SegmentGroup.Root
              size="sm"
              value={params.waveform}
              onValueChange={(details) => {
                if (isWaveform(details.value)) changeParams(id, { waveform: details.value })
              }}
            >
              <SegmentGroup.Indicator />
              {BASS_WAVEFORMS.map((wave) => (
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
              min={BASS_RANGES.cutoff.min}
              max={BASS_RANGES.cutoff.max}
              step={1}
              defaultValue={BASS_PARAMS_DEFAULT.cutoff}
              format={formatHz}
              onChange={(cutoff) => changeParams(id, { cutoff })}
            />
            <Knob
              label="Res"
              value={params.resonance}
              min={BASS_RANGES.resonance.min}
              max={BASS_RANGES.resonance.max}
              step={0.1}
              defaultValue={BASS_PARAMS_DEFAULT.resonance}
              format={formatQ}
              onChange={(resonance) => changeParams(id, { resonance })}
            />
            <Knob
              label="Env"
              value={params.envMod}
              min={BASS_RANGES.envMod.min}
              max={BASS_RANGES.envMod.max}
              step={0.01}
              defaultValue={BASS_PARAMS_DEFAULT.envMod}
              format={formatPercent}
              onChange={(envMod) => changeParams(id, { envMod })}
            />
            <Knob
              label="Decay"
              value={params.decay}
              min={BASS_RANGES.decay.min}
              max={BASS_RANGES.decay.max}
              step={0.01}
              defaultValue={BASS_PARAMS_DEFAULT.decay}
              format={formatMs}
              onChange={(decay) => changeParams(id, { decay })}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
