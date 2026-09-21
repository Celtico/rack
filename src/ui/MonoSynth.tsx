import { Flex, HStack } from "@chakra-ui/react"

import { KIND_TITLE, type InstanceOf } from "../state/instances"
import {
  selectInstance,
  SYNTH_PARAMS_DEFAULT,
  SYNTH_RANGES,
  useRackStore,
  WAVEFORMS,
} from "../state/store"
import { formatHz, formatMs, formatPercent, formatQ } from "./format"
import { ControlGroup } from "./ControlGroup"
import { FilterControls } from "./FilterControls"
import { Knob } from "./Knob"
import { ModPanel } from "./ModPanel"
import { PartTools } from "./PartTools"
import { RackUnit } from "./RackUnit"
import { TabDialog } from "./TabDialog"
import { KeyControls } from "./KeyControls"
import { SynthGrid } from "./TrackGrids"
import { WavePicker } from "./WavePicker"
import { changeParams, KIND_FINISH, kindIcon, useInstanceLabel } from "./unitMeta"

/** MONO-1: one note per column on an 8-row grid, with waveform, filter and decay. */
export function MonoSynth({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"synth"> | undefined
  const label = useInstanceLabel(inst)
  if (!inst) return null

  const params = inst.params

  return (
    <RackUnit
      id={id}
      model={label}
      title={KIND_TITLE.synth}
      units={3}
      finish={KIND_FINISH.synth}
      icon={kindIcon("synth")}
      instance
    >
      <Flex wrap="wrap" gap={{ base: "5", lg: "8" }} align="stretch">
        <SynthGrid id={id} />

        <Flex
          wrap="wrap"
          gap={{ base: "5", lg: "8" }}
          align="flex-start"
          alignContent="flex-start"
          flex="1 1 20rem"
          minW="0"
        >
          <KeyControls id={id} kind="synth" />
          <WavePicker
            value={params.waveform}
            options={WAVEFORMS}
            onChange={(waveform) => changeParams(id, { waveform })}
          />

          <FilterControls
            type={params.filterType}
            cutoff={params.cutoff}
            q={params.resonance}
            onTypeChange={(filterType) => changeParams(id, { filterType })}
          />

          <HStack gap="4" wrap="wrap" align="flex-start">
            <Knob
              label="Cutoff"
              scale="log"
              value={params.cutoff}
              min={SYNTH_RANGES.cutoff.min}
              max={SYNTH_RANGES.cutoff.max}
              step={1}
              defaultValue={SYNTH_PARAMS_DEFAULT.cutoff}
              format={formatHz}
              onChange={(cutoff) => changeParams(id, { cutoff })}
            />
            <Knob
              label="Res"
              value={params.resonance}
              min={SYNTH_RANGES.resonance.min}
              max={SYNTH_RANGES.resonance.max}
              step={0.1}
              defaultValue={SYNTH_PARAMS_DEFAULT.resonance}
              format={formatQ}
              onChange={(resonance) => changeParams(id, { resonance })}
            />
          </HStack>

          <ControlGroup title="Envelope">
            <HStack gap="4" wrap="wrap" align="flex-start">
              <Knob
                label="Attack"
                scale="log"
                value={params.attack}
                min={SYNTH_RANGES.attack.min}
                max={SYNTH_RANGES.attack.max}
                step={0.001}
                defaultValue={SYNTH_PARAMS_DEFAULT.attack}
                format={formatMs}
                onChange={(attack) => changeParams(id, { attack })}
              />
              <Knob
                label="Decay"
                value={params.decay}
                min={SYNTH_RANGES.decay.min}
                max={SYNTH_RANGES.decay.max}
                step={0.01}
                defaultValue={SYNTH_PARAMS_DEFAULT.decay}
                format={formatMs}
                onChange={(decay) => changeParams(id, { decay })}
              />
              <Knob
                label="Sustain"
                value={params.sustain}
                min={SYNTH_RANGES.sustain.min}
                max={SYNTH_RANGES.sustain.max}
                step={0.01}
                defaultValue={SYNTH_PARAMS_DEFAULT.sustain}
                format={formatPercent}
                onChange={(sustain) => changeParams(id, { sustain })}
              />
              <Knob
                label="Release"
                scale="log"
                value={params.release}
                min={SYNTH_RANGES.release.min}
                max={SYNTH_RANGES.release.max}
                step={0.01}
                defaultValue={SYNTH_PARAMS_DEFAULT.release}
                format={formatMs}
                onChange={(release) => changeParams(id, { release })}
              />
            </HStack>
          </ControlGroup>
          <PartTools id={id} kind="synth" />
          <ControlGroup title="Tab">
            <TabDialog id={id} label={label} onWritten={() => {}} />
          </ControlGroup>
        </Flex>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
