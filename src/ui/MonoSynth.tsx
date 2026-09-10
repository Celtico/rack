import { Flex, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"

import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import { SYNTH_NOTES, type SynthNote } from "../state/pattern"
import {
  selectInstance,
  selectTrack,
  SYNTH_PARAMS_DEFAULT,
  SYNTH_RANGES,
  useRackStore,
  WAVEFORMS,
  type Waveform,
} from "../state/store"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"
import {
  changeParams,
  formatHz,
  formatMs,
  formatQ,
  KIND_FINISH,
  kindIcon,
  WAVE_LABELS,
} from "./unitMeta"

/** Highest note on top, like a piano roll. */
const NOTE_ROWS = [...SYNTH_NOTES].reverse()

const isWaveform = (v: string | null): v is Waveform => WAVEFORMS.includes(v as Waveform)

/** MONO-1: one note per column on an 8-row grid, with waveform, filter and decay. */
export function MonoSynth({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"synth"> | undefined
  const track = useRackStore((s) => selectTrack(s, id))
  const all = useRackStore((s) => s.instances)
  const { toggleNote } = useRackStore.getState()
  if (!inst || track?.kind !== "synth") return null

  const params = inst.params
  const rows = NOTE_ROWS.map((note) => {
    const rowIndex = SYNTH_NOTES.indexOf(note)
    return { id: note, label: note, steps: track.notes.map((r) => r === rowIndex) }
  })

  return (
    <RackUnit
      id={id}
      model={instanceLabel(inst, all)}
      title={KIND_TITLE.synth}
      units={3}
      finish={KIND_FINISH.synth}
      icon={kindIcon("synth")}
      instance
    >
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <StepGrid
          rows={rows}
          onToggle={(note: SynthNote, step) => toggleNote(id, step, SYNTH_NOTES.indexOf(note))}
        />

        <VStack gap="4" align="flex-start" flexShrink={0}>
          <VStack gap="2" align="flex-start">
            <Text textStyle="silkscreen" color="rack.silkscreen.muted">
              Wave
            </Text>
            <SegmentGroup.Root
              size="sm"
              value={params.waveform}
              onValueChange={(details) => {
                if (isWaveform(details.value)) changeParams(id, { waveform: details.value })
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
              onChange={(cutoff) => changeParams(id, { cutoff })}
            />
            <Knob
              label="Res"
              value={params.resonance}
              min={SYNTH_RANGES.resonance.min}
              max={SYNTH_RANGES.resonance.max}
              step={0.1}
              defaultValue={SYNTH_PARAMS_DEFAULT.resonance}
              format={formatQ}
              onChange={(resonance) => changeParams(id, { resonance })}
            />
            <Knob
              label="Decay"
              value={params.decay}
              min={SYNTH_RANGES.decay.min}
              max={SYNTH_RANGES.decay.max}
              step={0.01}
              defaultValue={SYNTH_PARAMS_DEFAULT.decay}
              format={formatMs}
              onChange={(decay) => changeParams(id, { decay })}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
