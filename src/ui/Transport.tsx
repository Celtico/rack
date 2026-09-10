import { Flex, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { LuPlay, LuSquare } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { STEP_COUNT } from "../state/pattern"
import { BPM_DEFAULT, BPM_MAX, BPM_MIN, MASTER_DEFAULT, useRackStore } from "../state/store"
import { Display } from "./Display"
import { Knob } from "./Knob"
import { Led } from "./Led"
import { LevelMeter } from "./LevelMeter"
import { startTransport, stopTransport } from "./transportControl"

const formatBpm = (bpm: number) => `${bpm} BPM`
const formatPercent = (level: number) => `${Math.round(level * 100)}%`

const BEATS = Array.from({ length: STEP_COUNT / 4 }, (_, i) => i)

/** Step counter and beat LEDs — the only part of the panel that moves while playing. */
function StepReadout() {
  const currentStep = useRackStore((s) => s.currentStep)
  const currentBeat = currentStep < 0 ? -1 : Math.floor(currentStep / 4)
  return (
    <>
      <VStack gap="1" align="stretch">
        <Display size="lg" aria-label="Current step">
          {currentStep < 0 ? "--" : String(currentStep + 1).padStart(2, "0")}
        </Display>
        <Text textStyle="silkscreen" color="rack.silkscreen.muted" textAlign="center">
          Step
        </Text>
      </VStack>
      <VStack gap="1" align="center">
        <HStack gap="2" pb="1">
          {BEATS.map((beat) => (
            <Led key={beat} on={beat === currentBeat} label={`Beat ${beat + 1}`} />
          ))}
        </HStack>
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          Beat
        </Text>
      </VStack>
    </>
  )
}

/** Clock, tempo, swing, step readout and master — the controls of the top panel. */
export function Transport() {
  const bpm = useRackStore((s) => s.bpm)
  const swing = useRackStore((s) => s.swing)
  const playing = useRackStore((s) => s.playing)
  const masterVolume = useRackStore((s) => s.masterVolume)
  const { setBpm, setSwing, setMasterVolume } = useRackStore.getState()

  const togglePlay = () => (playing ? stopTransport() : startTransport())

  const changeBpm = (next: number) => {
    setBpm(next)
    getEngine().setBpm(next)
  }

  const changeMaster = (next: number) => {
    setMasterVolume(next)
    getEngine().setMasterVolume(next)
  }

  return (
    <Flex wrap="wrap" align="center" gap={{ base: "3", md: "8" }} rowGap={{ base: "4", md: "8" }}>
      <HStack gap="3" align="flex-end">
        <IconButton
          aria-label={playing ? "Stop" : "Play"}
          aria-pressed={playing}
          onClick={togglePlay}
          size="lg"
          variant="subtle"
          colorPalette={playing ? "orange" : "gray"}
          rounded="sm"
        >
          {playing ? <LuSquare /> : <LuPlay />}
        </IconButton>
        <VStack gap="1" align="center">
          <Led on={playing} label="Run" />
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            Run
          </Text>
        </VStack>
      </HStack>

      <HStack gap="3" align="flex-end">
        <Knob
          label="Tempo"
          value={bpm}
          min={BPM_MIN}
          max={BPM_MAX}
          defaultValue={BPM_DEFAULT}
          format={formatBpm}
          onChange={changeBpm}
        />
        <VStack gap="1" align="stretch">
          <Display size="lg" aria-label="Tempo">
            {bpm}
          </Display>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted" textAlign="center">
            BPM
          </Text>
        </VStack>
        <Knob
          label="Swing"
          value={swing}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0}
          format={formatPercent}
          onChange={setSwing}
        />
      </HStack>

      <HStack gap="3" align="flex-end">
        <StepReadout />
      </HStack>

      <HStack gap="3" align="flex-end">
        <Knob
          label="Master"
          value={masterVolume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={MASTER_DEFAULT}
          format={formatPercent}
          onChange={changeMaster}
        />
        <VStack gap="1" align="center">
          <LevelMeter source="master" label="Master level" />
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            Out
          </Text>
        </VStack>
      </HStack>
    </Flex>
  )
}
