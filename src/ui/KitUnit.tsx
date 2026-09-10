import { Flex, HStack, Text, VStack } from "@chakra-ui/react"

import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import { DRUM_VOICES, PERC_VOICES, type KitRows } from "../state/pattern"
import { selectInstance, selectTrack, useRackStore } from "../state/store"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"
import { changeParams, formatPercent, KIND_FINISH, kindIcon } from "./unitMeta"

const VOICE_LABELS: Readonly<Record<string, string>> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  hat: "Hat",
  tomLo: "Tom lo",
  tomHi: "Tom hi",
  rim: "Rim",
  cowbell: "Cowbell",
  shaker: "Shaker",
  crash: "Crash",
}

type KitInstance = InstanceOf<"drums"> | InstanceOf<"perc">

/** DR-4 or PERC-6: one-shot voices on a 16-step grid, with a level per voice. */
export function KitUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as KitInstance | undefined
  const track = useRackStore((s) => selectTrack(s, id))
  const all = useRackStore((s) => s.instances)
  const { toggleStep } = useRackStore.getState()
  if (!inst || !track || !("rows" in track)) return null

  const voices = inst.kind === "drums" ? DRUM_VOICES : PERC_VOICES
  const rows = track.rows as KitRows
  const levels = inst.params as Readonly<Record<string, number>>
  const gridRows = voices.map((voice) => ({
    id: voice,
    label: VOICE_LABELS[voice] ?? voice,
    steps: rows[voice] ?? [],
  }))

  return (
    <RackUnit
      id={id}
      model={instanceLabel(inst, all)}
      title={KIND_TITLE[inst.kind]}
      units={2}
      finish={KIND_FINISH[inst.kind]}
      icon={kindIcon(inst.kind)}
      instance
    >
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <StepGrid rows={gridRows} onToggle={(voice, step) => toggleStep(id, voice, step)} />

        <VStack gap="2" align="flex-start" flexShrink={0}>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            Level
          </Text>
          <HStack gap="4" wrap="wrap" maxW={{ lg: "48" }}>
            {voices.map((voice) => (
              <Knob
                key={voice}
                size="sm"
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
      </Flex>
    </RackUnit>
  )
}
