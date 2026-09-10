import { Flex, HStack, Text, VStack } from "@chakra-ui/react"

import { getEngine } from "../audio/engine"
import { DRUM_VOICES, type DrumVoiceId } from "../state/pattern"
import { DRUM_LEVELS_DEFAULT, selectPattern, useRackStore } from "../state/store"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"

const VOICE_LABELS: Record<DrumVoiceId, string> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  hat: "Hat",
}

const formatPercent = (level: number) => `${Math.round(level * 100)}%`

/** DR-4: four drum voices on a 16-step grid, with a level per voice. */
export function DrumMachine() {
  const drums = useRackStore((s) => selectPattern(s).drums)
  const currentStep = useRackStore((s) => s.currentStep)
  const levels = useRackStore((s) => s.drumLevels)
  const { toggleDrumStep, setDrumLevel } = useRackStore.getState()

  const rows = DRUM_VOICES.map((id) => ({ id, label: VOICE_LABELS[id], steps: drums[id] }))

  const changeLevel = (voice: DrumVoiceId) => (level: number) => {
    setDrumLevel(voice, level)
    getEngine().setDrumLevel(voice, level)
  }

  return (
    <RackUnit model="DR-4" title="Drum machine" units={2}>
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <StepGrid rows={rows} currentStep={currentStep} onToggle={toggleDrumStep} />

        <VStack gap="2" align="flex-start" flexShrink={0}>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            Level
          </Text>
          <HStack gap="4" wrap="wrap">
            {DRUM_VOICES.map((id) => (
              <Knob
                key={id}
                size="sm"
                label={VOICE_LABELS[id]}
                value={levels[id]}
                min={0}
                max={1}
                step={0.01}
                defaultValue={DRUM_LEVELS_DEFAULT[id]}
                format={formatPercent}
                onChange={changeLevel(id)}
              />
            ))}
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
