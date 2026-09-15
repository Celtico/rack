import { Flex, HStack, Text, VStack } from "@chakra-ui/react"

import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import { DRUM_VOICES, PERC_VOICES } from "../state/pattern"
import { selectInstance, useRackStore } from "../state/store"
import { StripFilterControls } from "./FilterControls"
import { Knob } from "./Knob"
import { ModPanel } from "./ModPanel"
import { PartTools } from "./PartTools"
import { RackUnit } from "./RackUnit"
import { KitGrid } from "./TrackGrids"
import { changeParams, formatPercent, KIND_FINISH, kindIcon, VOICE_LABELS } from "./unitMeta"

type KitInstance = InstanceOf<"drums"> | InstanceOf<"perc">

/** DR-4 or PERC-6: one-shot voices on a 16-step grid, with a level per voice. */
export function KitUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as KitInstance | undefined
  const all = useRackStore((s) => s.instances)
  if (!inst) return null

  const voices = inst.kind === "drums" ? DRUM_VOICES : PERC_VOICES
  const levels = inst.params as Readonly<Record<string, number>>

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
        <KitGrid id={id} />

        <Flex
          wrap="wrap"
          gap={{ base: "5", lg: "8" }}
          align="flex-start"
          alignContent="flex-start"
          flex="1"
          minW="0"
        >
          <VStack gap="2" align="flex-start">
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Level
            </Text>
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
          </VStack>
          {inst.filter && <StripFilterControls id={id} filter={inst.filter} />}
          <PartTools id={id} kind={inst.kind} />
        </Flex>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
