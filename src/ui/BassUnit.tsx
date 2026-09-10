import { Flex, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import { getEngine } from "../audio/engine"
import { BASS_NOTES, type BassFlag, type BassNote } from "../state/pattern"
import {
  BASS_PARAMS_DEFAULT,
  BASS_RANGES,
  BASS_WAVEFORMS,
  selectPattern,
  useRackStore,
  type BassParams,
  type BassWaveform,
} from "../state/store"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"

/** Highest note on top, then the two flag rows. */
const NOTE_ROWS = [...BASS_NOTES].reverse()
type RowId = BassNote | BassFlag

const WAVE_LABELS: Record<BassWaveform, string> = { sawtooth: "Saw", square: "Sqr" }

const isWaveform = (v: string | null): v is BassWaveform =>
  BASS_WAVEFORMS.includes(v as BassWaveform)
const isFlag = (id: RowId): id is BassFlag => id === "accent" || id === "slide"

const formatHz = (v: number) => `${Math.round(v)} Hz`
const formatQ = (v: number) => `Q ${v.toFixed(1)}`
const formatPercent = (v: number) => `${Math.round(v * 100)}%`
const formatMs = (v: number) => `${Math.round(v * 1000)} ms`

/** BASS-2: acid mono line — one note per column, plus accent and slide per step. */
export function BassUnit() {
  const bass = useRackStore((s) => selectPattern(s).bass)
  const currentStep = useRackStore((s) => s.currentStep)
  const params = useRackStore((s) => s.bassParams)
  const { toggleBassNote, toggleBassFlag, setBassParam } = useRackStore.getState()

  const rows = [
    ...NOTE_ROWS.map((note) => {
      const rowIndex = BASS_NOTES.indexOf(note)
      return { id: note as RowId, label: note, steps: bass.notes.map((r) => r === rowIndex) }
    }),
    { id: "accent" as RowId, label: "Accent", steps: bass.accent },
    { id: "slide" as RowId, label: "Slide", steps: bass.slide },
  ]

  const onToggle = (id: RowId, step: number) => {
    if (isFlag(id)) toggleBassFlag(step, id)
    else toggleBassNote(step, BASS_NOTES.indexOf(id))
  }

  const change =
    <K extends keyof BassParams>(key: K) =>
    (value: BassParams[K]) => {
      setBassParam(key, value)
      getEngine().setBassParam(key, value)
    }

  return (
    <RackUnit model="BASS-2" title="Acid bass" units={3} finish="silver" channel="bass">
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <StepGrid rows={rows} currentStep={currentStep} onToggle={onToggle} />

        <VStack gap="4" align="flex-start" flexShrink={0}>
          <VStack gap="2" align="flex-start">
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Wave
            </Text>
            <SegmentGroup.Root
              size="sm"
              value={params.waveform}
              onValueChange={(details) => {
                if (isWaveform(details.value)) change("waveform")(details.value)
              }}
            >
              <SegmentGroup.Indicator />
              {BASS_WAVEFORMS.map((wave) => (
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
              value={params.cutoff}
              min={BASS_RANGES.cutoff.min}
              max={BASS_RANGES.cutoff.max}
              step={1}
              defaultValue={BASS_PARAMS_DEFAULT.cutoff}
              format={formatHz}
              onChange={change("cutoff")}
            />
            <Knob
              label="Res"
              value={params.resonance}
              min={BASS_RANGES.resonance.min}
              max={BASS_RANGES.resonance.max}
              step={0.1}
              defaultValue={BASS_PARAMS_DEFAULT.resonance}
              format={formatQ}
              onChange={change("resonance")}
            />
            <Knob
              label="Env"
              value={params.envMod}
              min={BASS_RANGES.envMod.min}
              max={BASS_RANGES.envMod.max}
              step={0.01}
              defaultValue={BASS_PARAMS_DEFAULT.envMod}
              format={formatPercent}
              onChange={change("envMod")}
            />
            <Knob
              label="Decay"
              value={params.decay}
              min={BASS_RANGES.decay.min}
              max={BASS_RANGES.decay.max}
              step={0.01}
              defaultValue={BASS_PARAMS_DEFAULT.decay}
              format={formatMs}
              onChange={change("decay")}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
