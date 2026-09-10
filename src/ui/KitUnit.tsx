import { Flex, HStack, Text, VStack } from "@chakra-ui/react"

import type { ReactNode } from "react"

import type { ChannelId } from "../state/channels"
import type { UnitId } from "../state/layout"
import type { KitRows } from "../state/pattern"
import type { Finish } from "../theme/recipes/rackUnit"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"

export interface KitUnitProps<Id extends string> {
  model: UnitId
  title: string
  finish: Finish
  channel: ChannelId
  icon: ReactNode
  voices: readonly Id[]
  labels: Readonly<Record<Id, string>>
  rows: KitRows<Id>
  levels: Readonly<Record<Id, number>>
  defaultLevels: Readonly<Record<Id, number>>
  currentStep: number
  onToggle: (voice: Id, step: number) => void
  onLevel: (voice: Id, level: number) => void
}

const formatPercent = (level: number) => `${Math.round(level * 100)}%`

/** A kit of one-shot voices on a 16-step grid, with a level per voice. DR-4 and PERC-6. */
export function KitUnit<Id extends string>({
  model,
  title,
  finish,
  channel,
  icon,
  voices,
  labels,
  rows,
  levels,
  defaultLevels,
  currentStep,
  onToggle,
  onLevel,
}: KitUnitProps<Id>) {
  const gridRows = voices.map((id) => ({ id, label: labels[id], steps: rows[id] }))

  return (
    <RackUnit model={model} title={title} units={2} finish={finish} channel={channel} icon={icon}>
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <StepGrid rows={gridRows} currentStep={currentStep} onToggle={onToggle} />

        <VStack gap="2" align="flex-start" flexShrink={0}>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            Level
          </Text>
          <HStack gap="4" wrap="wrap" maxW={{ lg: "48" }}>
            {voices.map((id) => (
              <Knob
                key={id}
                size="sm"
                label={labels[id]}
                value={levels[id]}
                min={0}
                max={1}
                step={0.01}
                defaultValue={defaultLevels[id]}
                format={formatPercent}
                onChange={(level) => onLevel(id, level)}
              />
            ))}
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
