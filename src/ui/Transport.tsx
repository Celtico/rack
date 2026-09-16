import { Flex, HStack, Text, VStack } from "@chakra-ui/react"

import { getEngine } from "../audio/engine"
import { STEP_COUNT } from "../state/pattern"
import { BPM_DEFAULT, BPM_MAX, BPM_MIN, MASTER_DEFAULT, useRackStore } from "../state/store"
import { Display } from "./Display"
import { Knob } from "./Knob"
import { Led } from "./Led"
import { LevelMeter } from "./LevelMeter"
import { RunButton } from "./RunButton"

const formatBpm = (bpm: number) => `${bpm} BPM`
const formatPercent = (level: number) => `${Math.round(level * 100)}%`

const BEATS = Array.from({ length: STEP_COUNT / 4 }, (_, i) => i)

/** The four beat LEDs — moves while playing, so it subscribes on its own. */
function BeatLeds() {
  const currentStep = useRackStore((s) => s.currentStep)
  const currentBeat = currentStep < 0 ? -1 : Math.floor(currentStep / 4)
  return (
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
  )
}

/** Step counter — the other moving part. */
function StepDisplay() {
  const currentStep = useRackStore((s) => s.currentStep)
  return (
    <VStack gap="1" align="stretch">
      <Display size="lg" aria-label="Current step">
        {currentStep < 0 ? "--" : String(currentStep + 1).padStart(2, "0")}
      </Display>
      <Text textStyle="silkscreen" color="rack.silkscreen.muted" textAlign="center">
        Step
      </Text>
    </VStack>
  )
}

/**
 * On a phone the rows and groups are flex boxes; from `md` they dissolve
 * (`display: contents`) so every control is a direct child of the panel row
 * and the nine of them spread evenly across its width.
 */
const GROUP = { base: "flex", md: "contents" } as const

/**
 * Clock, tempo, swing, master and the readouts — the controls of the top panel.
 * Two rows on a phone: the run button with the three knobs, then the beat LEDs
 * with the displays and the master meter. One evenly spread row on a desktop.
 */
export function Transport() {
  const bpm = useRackStore((s) => s.bpm)
  const swing = useRackStore((s) => s.swing)
  const playing = useRackStore((s) => s.playing)
  const masterVolume = useRackStore((s) => s.masterVolume)
  const { setBpm, setSwing, setMasterVolume } = useRackStore.getState()

  const changeBpm = (next: number) => {
    setBpm(next)
    getEngine().setBpm(next)
  }

  const changeMaster = (next: number) => {
    setMasterVolume(next)
    getEngine().setMasterVolume(next)
  }

  return (
    <Flex
      direction={{ base: "column", md: "row" }}
      // The row wraps when the rack is narrow beside a wide side panel (the breakpoint is the
      // viewport's, not the rack's), so nothing is pushed past the panel's edge.
      wrap={{ md: "wrap" }}
      justify={{ md: "space-between" }}
      align={{ base: "stretch", md: "flex-end" }}
      gap={{ base: "5", md: "6" }}
      px={{ md: "2" }}
    >
      <HStack display={GROUP} justify="space-between" align="flex-end" gap="4">
        <HStack display={GROUP} gap="3" align="flex-end">
          <RunButton />
          <VStack gap="1" align="center">
            <Led on={playing} label="Run" />
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Run
            </Text>
          </VStack>
        </HStack>

        <HStack display={GROUP} gap="4" align="flex-end">
          <Knob
            label="Tempo"
            value={bpm}
            min={BPM_MIN}
            max={BPM_MAX}
            defaultValue={BPM_DEFAULT}
            format={formatBpm}
            onChange={changeBpm}
          />
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
        </HStack>
      </HStack>

      <HStack display={GROUP} justify="space-between" align="flex-end" gap="4">
        <BeatLeds />
        <HStack display={GROUP} gap="3" align="flex-end">
          <VStack gap="1" align="stretch">
            <Display size="lg" aria-label="Tempo">
              {bpm}
            </Display>
            <Text textStyle="silkscreen" color="rack.silkscreen.muted" textAlign="center">
              BPM
            </Text>
          </VStack>
          <StepDisplay />
          <VStack gap="1" align="center">
            <LevelMeter source="master" label="Master level" />
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Out
            </Text>
          </VStack>
        </HStack>
      </HStack>
    </Flex>
  )
}
