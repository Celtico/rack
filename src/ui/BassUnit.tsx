import { Flex, HStack } from "@chakra-ui/react"

import { KIND_TITLE, type InstanceOf } from "../state/instances"
import {
  BASS_PARAMS_DEFAULT,
  BASS_RANGES,
  BASS_WAVEFORMS,
  selectInstance,
  useRackStore,
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
import { BassGrid } from "./TrackGrids"
import { WavePicker } from "./WavePicker"
import { changeParams, KIND_FINISH, kindIcon, useInstanceLabel } from "./unitMeta"

/** BASS-2: acid mono line — one note per column, plus accent and slide per step. */
export function BassUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"bass"> | undefined
  const label = useInstanceLabel(inst)
  if (!inst) return null

  const params = inst.params

  return (
    <RackUnit
      id={id}
      model={label}
      title={KIND_TITLE.bass}
      units={3}
      finish={KIND_FINISH.bass}
      icon={kindIcon("bass")}
      instance
    >
      <Flex wrap="wrap" gap={{ base: "5", lg: "8" }} align="stretch">
        <BassGrid id={id} />

        <Flex
          wrap="wrap"
          gap={{ base: "5", lg: "8" }}
          align="flex-start"
          alignContent="flex-start"
          flex="1 1 20rem"
          minW="0"
        >
          <KeyControls id={id} kind="bass" />
          <WavePicker
            value={params.waveform}
            options={BASS_WAVEFORMS}
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
          </HStack>

          <ControlGroup title="Envelope">
            <HStack gap="4" wrap="wrap" align="flex-start">
              <Knob
                label="Attack"
                scale="log"
                value={params.attack}
                min={BASS_RANGES.attack.min}
                max={BASS_RANGES.attack.max}
                step={0.001}
                defaultValue={BASS_PARAMS_DEFAULT.attack}
                format={formatMs}
                onChange={(attack) => changeParams(id, { attack })}
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
              <Knob
                label="Sustain"
                value={params.sustain}
                min={BASS_RANGES.sustain.min}
                max={BASS_RANGES.sustain.max}
                step={0.01}
                defaultValue={BASS_PARAMS_DEFAULT.sustain}
                format={formatPercent}
                onChange={(sustain) => changeParams(id, { sustain })}
              />
              <Knob
                label="Release"
                scale="log"
                value={params.release}
                min={BASS_RANGES.release.min}
                max={BASS_RANGES.release.max}
                step={0.01}
                defaultValue={BASS_PARAMS_DEFAULT.release}
                format={formatMs}
                onChange={(release) => changeParams(id, { release })}
              />
            </HStack>
          </ControlGroup>
          <PartTools id={id} kind="bass" />
          <ControlGroup title="Tab">
            <TabDialog id={id} label={label} onWritten={() => {}} />
          </ControlGroup>
        </Flex>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
