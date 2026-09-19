import { Flex, HStack } from "@chakra-ui/react"

import { KIND_TITLE, type InstanceOf } from "../state/instances"
import { DRUM_VOICES, PERC_VOICES } from "../state/pattern"
import { selectInstance, useRackStore } from "../state/store"
import { formatPercent } from "./format"
import { ControlGroup } from "./ControlGroup"
import { StripFilterControls } from "./FilterControls"
import { Knob } from "./Knob"
import { ModPanel } from "./ModPanel"
import { PartTools } from "./PartTools"
import { RackUnit } from "./RackUnit"
import { KitGrid } from "./TrackGrids"
import { changeParams, KIND_FINISH, kindIcon, VOICE_LABELS, useInstanceLabel } from "./unitMeta"

type KitInstance = InstanceOf<"drums"> | InstanceOf<"perc">

/** DR-4 or PERC-6: one-shot voices on a 16-step grid, with a level per voice. */
export function KitUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as KitInstance | undefined
  const label = useInstanceLabel(inst)
  if (!inst) return null

  const voices = inst.kind === "drums" ? DRUM_VOICES : PERC_VOICES
  const levels = inst.params as Readonly<Record<string, number>>

  return (
    <RackUnit
      id={id}
      model={label}
      title={KIND_TITLE[inst.kind]}
      units={3}
      finish={KIND_FINISH[inst.kind]}
      icon={kindIcon(inst.kind)}
      instance
    >
      {/* The grid, then the controls beside it while at least 20rem are free, else under it: a
          wrapping row rather than a viewport breakpoint, since a wide side panel narrows the rack. */}
      <Flex wrap="wrap" gap={{ base: "5", lg: "8" }} align="stretch">
        <KitGrid id={id} />

        <Flex
          wrap="wrap"
          gap={{ base: "5", lg: "8" }}
          align="flex-start"
          alignContent="flex-start"
          flex="1 1 20rem"
          minW="0"
        >
          <ControlGroup title="Level">
            <HStack gap="4" wrap="wrap">
              {voices.map((voice) => (
                <Knob
                  key={voice}
                  label={VOICE_LABELS[voice] ?? voice}
                  value={levels[voice] ?? 0}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.7}
                  format={formatPercent}
                  onChange={(level) => changeParams(id, { [voice]: level })}
                />
              ))}
            </HStack>
          </ControlGroup>
          {inst.filter && <StripFilterControls id={id} filter={inst.filter} />}
          <PartTools id={id} kind={inst.kind} />
        </Flex>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
