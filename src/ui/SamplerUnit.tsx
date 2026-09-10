import { Button, chakra, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { useRef, type ChangeEvent } from "react"
import { LuAudioWaveform, LuEraser, LuUpload } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { PAD_IDS, type PadId } from "../state/pattern"
import {
  PAD_DEFAULT,
  PAD_RANGES,
  selectPattern,
  useRackStore,
  type PadParams,
} from "../state/store"
import { Display } from "./Display"
import { Knob } from "./Knob"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"

const padNumber = (pad: PadId) => pad.replace("pad", "")
const shortName = (name: string | null, pad: PadId) =>
  name ? name.replace(/\.[^.]+$/, "").slice(0, 10) : `Pad ${padNumber(pad)}`

const formatSemitones = (v: number) => `${v > 0 ? "+" : ""}${v} st`
const formatSeconds = (v: number) => `${v.toFixed(2)} s`
const formatPercent = (v: number) => `${Math.round(v * 100)}%`

/**
 * SMP-8: eight pads with the user's own samples. Audio lives in the browser
 * (IndexedDB); the song keeps each pad's name, pitch, decay and level.
 */
export function SamplerUnit() {
  const samples = useRackStore((s) => selectPattern(s).samples)
  const currentStep = useRackStore((s) => s.currentStep)
  const pads = useRackStore((s) => s.pads)
  const selected = useRackStore((s) => s.selectedPad)
  const { toggleSampleStep, selectPad, setPadParam } = useRackStore.getState()
  const fileInput = useRef<HTMLInputElement>(null)

  const pad = pads[selected]
  const rows = PAD_IDS.map((id) => ({
    id,
    label: shortName(pads[id].name, id),
    steps: samples[id],
  }))

  const change =
    <K extends keyof PadParams>(key: K) =>
    (value: PadParams[K]) => {
      setPadParam(selected, key, value)
      getEngine().setPadParams(selected, { ...useRackStore.getState().pads[selected] })
    }

  const pick = (id: PadId) => {
    selectPad(id)
    getEngine().triggerHit(id)
  }

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      await getEngine().importSample(selected, file.name, await file.arrayBuffer())
      setPadParam(selected, "name", file.name)
      toaster.create({
        type: "success",
        title: `Pad ${padNumber(selected)}`,
        description: file.name,
      })
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Could not load sample",
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const clear = async () => {
    await getEngine().clearSample(selected)
    setPadParam(selected, "name", null)
  }

  return (
    <RackUnit
      model="SMP-8"
      title="Sampler"
      units={2}
      finish="teal"
      channel="sampler"
      icon={<LuAudioWaveform />}
    >
      <Flex direction={{ base: "column", xl: "row" }} gap={{ base: "5", xl: "8" }} align="stretch">
        <StepGrid rows={rows} currentStep={currentStep} onToggle={toggleSampleStep} />

        <VStack gap="3" align="flex-start" flexShrink={0} maxW={{ xl: "64" }}>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            Pad
          </Text>
          <HStack gap="1" wrap="wrap">
            {PAD_IDS.map((id) => (
              <Button
                key={id}
                size="xs"
                rounded="sm"
                variant={id === selected ? "solid" : "subtle"}
                colorPalette={id === selected ? "orange" : "gray"}
                aria-pressed={id === selected}
                aria-label={`Select pad ${padNumber(id)}`}
                onClick={() => pick(id)}
              >
                {padNumber(id)}
              </Button>
            ))}
          </HStack>

          <HStack gap="2" wrap="wrap">
            <Display size="sm" aria-label="Sample" minW="24" title={pad.name ?? undefined}>
              {pad.name ? shortName(pad.name, selected) : "— empty —"}
            </Display>
            <Button
              size="xs"
              rounded="sm"
              variant="subtle"
              onClick={() => fileInput.current?.click()}
            >
              <LuUpload /> Load
            </Button>
            <Button
              size="xs"
              rounded="sm"
              variant="outline"
              onClick={clear}
              disabled={pad.name === null}
              aria-label={`Clear pad ${padNumber(selected)}`}
            >
              <LuEraser />
            </Button>
            <chakra.input
              ref={fileInput}
              type="file"
              accept="audio/*"
              onChange={load}
              srOnly
              aria-label="Load sample file"
            />
          </HStack>

          <HStack gap="4" wrap="wrap">
            <Knob
              size="sm"
              label="Pitch"
              value={pad.pitch}
              min={PAD_RANGES.pitch.min}
              max={PAD_RANGES.pitch.max}
              step={1}
              defaultValue={PAD_DEFAULT.pitch}
              format={formatSemitones}
              onChange={change("pitch")}
            />
            <Knob
              size="sm"
              label="Decay"
              scale="log"
              value={pad.decay}
              min={PAD_RANGES.decay.min}
              max={PAD_RANGES.decay.max}
              step={0.01}
              defaultValue={PAD_DEFAULT.decay}
              format={formatSeconds}
              onChange={change("decay")}
            />
            <Knob
              size="sm"
              label="Level"
              value={pad.level}
              min={0}
              max={1}
              step={0.01}
              defaultValue={PAD_DEFAULT.level}
              format={formatPercent}
              onChange={change("level")}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
