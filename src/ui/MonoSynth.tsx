import { Flex, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import { getEngine } from "../audio/engine"
import { SYNTH_NOTES, type SynthNote } from "../state/pattern"
import {
  selectPattern,
  SYNTH_PARAMS_DEFAULT,
  SYNTH_RANGES,
  useRackStore,
  WAVEFORMS,
  type SynthParams,
  type Waveform,
} from "../state/store"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"

/** Highest note on top, like a piano roll. */
const NOTE_ROWS = [...SYNTH_NOTES].reverse()

const WAVE_LABELS: Record<Waveform, string> = {
  sawtooth: "Saw",
  square: "Sqr",
  triangle: "Tri",
  sine: "Sin",
}

const isWaveform = (v: string | null): v is Waveform => WAVEFORMS.includes(v as Waveform)

const formatHz = (v: number) => `${Math.round(v)} Hz`
const formatQ = (v: number) => `Q ${v.toFixed(1)}`
const formatMs = (v: number) => `${Math.round(v * 1000)} ms`

/** MONO-1: one note per column on an 8-row grid, with waveform, filter and decay. */
export function MonoSynth() {
  const synth = useRackStore((s) => selectPattern(s).synth)
  const currentStep = useRackStore((s) => s.currentStep)
  const params = useRackStore((s) => s.synthParams)
  const { toggleSynthNote, setSynthParam } = useRackStore.getState()

  const rows = NOTE_ROWS.map((note) => {
    const rowIndex = SYNTH_NOTES.indexOf(note)
    return { id: note, label: note, steps: synth.map((r) => r === rowIndex) }
  })

  const onToggle = (note: SynthNote, step: number) =>
    toggleSynthNote(step, SYNTH_NOTES.indexOf(note))

  const change =
    <K extends keyof SynthParams>(key: K) =>
    (value: SynthParams[K]) => {
      setSynthParam(key, value)
      getEngine().setSynthParam(key, value)
    }

  return (
    <RackUnit model="MONO-1" title="Mono synth" units={3}>
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
              {WAVEFORMS.map((wave) => (
                <SegmentGroup.Item key={wave} value={wave}>
                  <SegmentGroup.ItemText>{WAVE_LABELS[wave]}</SegmentGroup.ItemText>
                  <SegmentGroup.ItemHiddenInput />
                </SegmentGroup.Item>
              ))}
            </SegmentGroup.Root>
          </VStack>

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
              onChange={change("cutoff")}
            />
            <Knob
              label="Res"
              value={params.resonance}
              min={SYNTH_RANGES.resonance.min}
              max={SYNTH_RANGES.resonance.max}
              step={0.1}
              defaultValue={SYNTH_PARAMS_DEFAULT.resonance}
              format={formatQ}
              onChange={change("resonance")}
            />
            <Knob
              label="Decay"
              value={params.decay}
              min={SYNTH_RANGES.decay.min}
              max={SYNTH_RANGES.decay.max}
              step={0.01}
              defaultValue={SYNTH_PARAMS_DEFAULT.decay}
              format={formatMs}
              onChange={change("decay")}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
