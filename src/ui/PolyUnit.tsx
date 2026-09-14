import { Flex, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import {
  EP_PARAMS_DEFAULT,
  EP_RANGES,
  POLY_PARAMS_DEFAULT,
  POLY_RANGES,
  selectInstance,
  STRINGS_PARAMS_DEFAULT,
  STRINGS_RANGES,
  useRackStore,
  WAVEFORMS,
  type Waveform,
} from "../state/store"
import { Knob } from "./Knob"
import { PolyGrid } from "./PolyGrid"
import { RackUnit } from "./RackUnit"
import {
  changeParams,
  formatHz,
  formatMs,
  formatPercent,
  formatSeconds,
  KIND_FINISH,
  kindIcon,
  WAVE_LABELS,
} from "./unitMeta"

const isWaveform = (v: string | null): v is Waveform => WAVEFORMS.includes(v as Waveform)
const formatRatio = (v: number) => `${v.toFixed(2)}×`
const formatIndex = (v: number) => v.toFixed(1)
const formatSustain = (v: number) => v.toFixed(3)

type PolyInstance = InstanceOf<"poly"> | InstanceOf<"ep"> | InstanceOf<"strings">

/** POLY-4 pad controls: wave, cutoff and a full ADSR. */
function PadControls({ id, inst }: { id: string; inst: InstanceOf<"poly"> }) {
  const p = inst.params
  return (
    <>
      <VStack gap="2" align="flex-start">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          Wave
        </Text>
        <SegmentGroup.Root
          size="sm"
          value={p.waveform}
          onValueChange={(details) => {
            if (isWaveform(details.value)) changeParams(id, { waveform: details.value })
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
          value={p.cutoff}
          min={POLY_RANGES.cutoff.min}
          max={POLY_RANGES.cutoff.max}
          step={1}
          defaultValue={POLY_PARAMS_DEFAULT.cutoff}
          format={formatHz}
          onChange={(cutoff) => changeParams(id, { cutoff })}
        />
        <Knob
          label="Attack"
          scale="log"
          value={p.attack}
          min={POLY_RANGES.attack.min}
          max={POLY_RANGES.attack.max}
          step={0.001}
          defaultValue={POLY_PARAMS_DEFAULT.attack}
          format={formatMs}
          onChange={(attack) => changeParams(id, { attack })}
        />
        <Knob
          label="Decay"
          scale="log"
          value={p.decay}
          min={POLY_RANGES.decay.min}
          max={POLY_RANGES.decay.max}
          step={0.01}
          defaultValue={POLY_PARAMS_DEFAULT.decay}
          format={formatMs}
          onChange={(decay) => changeParams(id, { decay })}
        />
        <Knob
          label="Sustain"
          value={p.sustain}
          min={POLY_RANGES.sustain.min}
          max={POLY_RANGES.sustain.max}
          step={0.01}
          defaultValue={POLY_PARAMS_DEFAULT.sustain}
          format={formatPercent}
          onChange={(sustain) => changeParams(id, { sustain })}
        />
        <Knob
          label="Release"
          scale="log"
          value={p.release}
          min={POLY_RANGES.release.min}
          max={POLY_RANGES.release.max}
          step={0.01}
          defaultValue={POLY_PARAMS_DEFAULT.release}
          format={formatMs}
          onChange={(release) => changeParams(id, { release })}
        />
      </HStack>
    </>
  )
}

/** EP-1 controls: FM ratio and index, decay and release. */
function PianoControls({ id, inst }: { id: string; inst: InstanceOf<"ep"> }) {
  const p = inst.params
  return (
    <HStack gap="4" wrap="wrap" align="flex-start" maxW={{ lg: "56" }}>
      <Knob
        label="Tone"
        value={p.tone}
        min={EP_RANGES.tone.min}
        max={EP_RANGES.tone.max}
        step={0.01}
        defaultValue={EP_PARAMS_DEFAULT.tone}
        format={formatRatio}
        onChange={(tone) => changeParams(id, { tone })}
      />
      <Knob
        label="Bright"
        value={p.bright}
        min={EP_RANGES.bright.min}
        max={EP_RANGES.bright.max}
        step={0.1}
        defaultValue={EP_PARAMS_DEFAULT.bright}
        format={formatIndex}
        onChange={(bright) => changeParams(id, { bright })}
      />
      <Knob
        label="Decay"
        scale="log"
        value={p.decay}
        min={EP_RANGES.decay.min}
        max={EP_RANGES.decay.max}
        step={0.01}
        defaultValue={EP_PARAMS_DEFAULT.decay}
        format={formatSeconds}
        onChange={(decay) => changeParams(id, { decay })}
      />
      <Knob
        label="Release"
        scale="log"
        value={p.release}
        min={EP_RANGES.release.min}
        max={EP_RANGES.release.max}
        step={0.01}
        defaultValue={EP_PARAMS_DEFAULT.release}
        format={formatSeconds}
        onChange={(release) => changeParams(id, { release })}
      />
    </HStack>
  )
}

/** STR-6 controls: dampening, sustain and release of the strings. */
function GuitarControls({ id, inst }: { id: string; inst: InstanceOf<"strings"> }) {
  const p = inst.params
  return (
    <HStack gap="4" wrap="wrap" align="flex-start" maxW={{ lg: "56" }}>
      <Knob
        label="Damp"
        scale="log"
        value={p.damp}
        min={STRINGS_RANGES.damp.min}
        max={STRINGS_RANGES.damp.max}
        step={1}
        defaultValue={STRINGS_PARAMS_DEFAULT.damp}
        format={formatHz}
        onChange={(damp) => changeParams(id, { damp })}
      />
      <Knob
        label="Sustain"
        value={p.sustain}
        min={STRINGS_RANGES.sustain.min}
        max={STRINGS_RANGES.sustain.max}
        step={0.001}
        defaultValue={STRINGS_PARAMS_DEFAULT.sustain}
        format={formatSustain}
        onChange={(sustain) => changeParams(id, { sustain })}
      />
      <Knob
        label="Release"
        scale="log"
        value={p.release}
        min={STRINGS_RANGES.release.min}
        max={STRINGS_RANGES.release.max}
        step={0.01}
        defaultValue={STRINGS_PARAMS_DEFAULT.release}
        format={formatSeconds}
        onChange={(release) => changeParams(id, { release })}
      />
    </HStack>
  )
}

/** POLY-4, EP-1 or STR-6: a chord grid plus the controls of the kind. */
export function PolyUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as PolyInstance | undefined
  const all = useRackStore((s) => s.instances)
  if (!inst) return null

  return (
    <RackUnit
      id={id}
      model={instanceLabel(inst, all)}
      title={KIND_TITLE[inst.kind]}
      units={3}
      finish={KIND_FINISH[inst.kind]}
      icon={kindIcon(inst.kind)}
      instance
    >
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <PolyGrid id={id} />
        <VStack gap="4" align="flex-start" flexShrink={0}>
          {inst.kind === "poly" && <PadControls id={id} inst={inst} />}
          {inst.kind === "ep" && <PianoControls id={id} inst={inst} />}
          {inst.kind === "strings" && <GuitarControls id={id} inst={inst} />}
        </VStack>
      </Flex>
    </RackUnit>
  )
}
