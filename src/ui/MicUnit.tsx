import { Button, Flex, Grid, HStack, SegmentGroup, Text, VStack } from "@chakra-ui/react"
import { useState } from "react"
import { LuCircle, LuEraser, LuHeadphones, LuMic, LuMicOff, LuSquare } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { getMicStream, micStream } from "../audio/mic"
import type { Take } from "../audio/sampleStore"
import { toaster } from "../components/ui/toaster"
import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import { VIDEO_VOICES, type VideoVoiceId } from "../state/pattern"
import {
  MIC_BARS,
  MIC_PARAMS_DEFAULT,
  MIC_RANGES,
  selectInstance,
  selectTrack,
  useRackStore,
  type MicBars,
} from "../state/store"
import { ControlCard } from "./ControlCard"
import { Display } from "./Display"
import { FilterControls } from "./FilterControls"
import { Knob } from "./Knob"
import { ModPanel } from "./ModPanel"
import { FilterTools, PatternTools } from "./PartTools"
import { RackUnit } from "./RackUnit"
import { StepGrid } from "./StepGrid"
import { takesChanged } from "./takes"
import { TakesList } from "./TakesList"
import { startTransport } from "./transportControl"
import {
  changeParams,
  formatHz,
  formatPercent,
  formatQ,
  KIND_FINISH,
  kindIcon,
  VOICE_LABELS,
} from "./unitMeta"

const isBars = (v: string | null): v is `${MicBars}` => MIC_BARS.some((b) => String(b) === v)

/** The gate row: sixteen steps that let the microphone through or cut it. */
function GateGrid({ id }: { id: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const { toggleStep } = useRackStore.getState()
  if (!track || !("rows" in track)) return null
  const rows = VIDEO_VOICES.map((voice) => ({
    id: voice,
    label: VOICE_LABELS[voice] ?? voice,
    steps: (track.rows as Record<string, readonly boolean[]>)[voice] ?? [],
  }))
  return (
    <StepGrid rows={rows} onToggle={(voice: VideoVoiceId, step) => toggleStep(id, voice, step)} />
  )
}

/**
 * MIC-1: the microphone through the rack. Once the browser has granted it,
 * the input is heard live (headphones!) through the gate row, the machine's
 * filter, then drive and FX like any other machine; Rec takes a loop of 1–8
 * bars on the bar, which then plays with the clock and starts over every
 * that many bars. Both are kept: the loop in the browser, its name and
 * tempo in the song.
 */
export function MicUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"mic"> | undefined
  const label = useRackStore((s) => (inst ? instanceLabel(inst, s.instances) : ""))
  const playing = useRackStore((s) => s.playing)
  const playingBar = useRackStore((s) => s.playingBar)
  // Whether the microphone feeds this machine, and the take under way (armed for a bar, then
  // recording up to `bars` bars) — UI state only.
  const [on, setOn] = useState(() => micStream() !== null)
  const [take, setTake] = useState<{ start: number; bars: number } | null>(null)
  if (!inst) return null
  const p = inst.params
  const recording = take !== null
  const armed = take !== null && playingBar < take.start
  const barsTaken = take ? Math.min(Math.max(0, playingBar - take.start) + 1, take.bars) : 0

  const enable = async () => {
    try {
      const stream = await getMicStream()
      getEngine().build().attachMic(stream)
      setOn(true)
    } catch (err) {
      toaster.create({
        type: "error",
        title: "No microphone",
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Rec arms a take of up to `bars` bars from the next bar where the loop's cycle begins; Stop ends
  // it on the bar line (or drops it while still armed) and the loop is the whole bars it got.
  const record = async () => {
    if (take) {
      getEngine().stopRecording(id)
      return
    }
    try {
      if (!useRackStore.getState().playing) await startTransport()
      const bars = p.bars
      const took = await getEngine().recordLoop(id, bars, (start) => setTake({ start, bars }))
      if (took) {
        changeParams(id, {
          loopKey: took.key,
          loopName: took.name,
          loopBpm: took.bpm,
          bars: took.bars,
        })
        takesChanged()
        toaster.create({ type: "success", title: "Loop recorded", description: took.name })
      }
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Could not record",
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTake(null)
    }
  }

  // The loop off the player; the take stays in the list below.
  const clear = () => {
    getEngine().clearLoop(id)
    changeParams(id, { loopKey: null, loopName: null })
  }

  // A take from the list as the loop: its bars and tempo come with it (a clip has none: one bar
  // at the clock's tempo, so it plays as it was taken).
  const use = async (take: Take) => {
    if (recording) return
    if (!(await getEngine().build().useTake(id, take.key))) {
      takesChanged()
      return
    }
    changeParams(id, {
      loopKey: take.key,
      loopName: take.name,
      loopBpm: take.bpm ?? useRackStore.getState().bpm,
      bars: take.bars ?? 1,
    })
  }

  return (
    <RackUnit
      id={id}
      model={label}
      title={KIND_TITLE.mic}
      units={3}
      finish={KIND_FINISH.mic}
      icon={kindIcon("mic")}
      instance
    >
      <Flex wrap="wrap" gap={{ base: "5", lg: "8" }} align="stretch">
        <GateGrid id={id} />

        {/* The cards as many across as fit at 15rem, three at most — decided by the room here, not
            the viewport (a wide side panel narrows the rack) — tight; the part tools under them. */}
        <VStack flex="1 1 20rem" minW="0" align="stretch" gap="3">
          <Grid
            templateColumns="repeat(auto-fit, minmax(max(15rem, 30%), 1fr))"
            gap="2"
            alignItems="stretch"
          >
            <ControlCard title="Input">
              <HStack gap="2" wrap="wrap">
                <Display
                  tone={recording ? "red" : on ? "green" : "red"}
                  minW="24"
                  aria-label="Microphone"
                >
                  {!on
                    ? "OFF"
                    : armed
                      ? "ARMED"
                      : recording
                        ? `● REC ${barsTaken}/${take.bars}`
                        : "LIVE"}
                </Display>
                {!on ? (
                  <Button
                    size="xs"
                    rounded="sm"
                    variant="solid"
                    colorPalette="orange"
                    onClick={enable}
                  >
                    <LuMic /> Enable mic
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    rounded="sm"
                    variant={p.live ? "solid" : "outline"}
                    colorPalette={p.live ? "orange" : "gray"}
                    aria-pressed={p.live}
                    onClick={() => changeParams(id, { live: !p.live })}
                  >
                    {p.live ? <LuMic /> : <LuMicOff />} Live
                  </Button>
                )}
              </HStack>
              <HStack gap="1" color="rack.silkscreen.muted">
                <LuHeadphones />
                <Text textStyle="silkscreen">Use headphones, or the speakers feed back.</Text>
              </HStack>
            </ControlCard>

            <ControlCard title="Loop">
              <HStack gap="2" wrap="wrap">
                <Display tone="amber" minW="28" aria-label="Loop">
                  {p.loopName ?? "— empty —"}
                </Display>
                <Button
                  size="xs"
                  rounded="sm"
                  variant="solid"
                  colorPalette={recording ? "gray" : "red"}
                  disabled={!on}
                  aria-label={
                    armed
                      ? "Cancel the take"
                      : recording
                        ? "Stop recording at the end of this bar"
                        : `Record a loop of up to ${p.bars} bars`
                  }
                  title={
                    recording
                      ? undefined
                      : playing
                        ? "From the next bar where the loop's cycle begins; Stop ends it on the bar"
                        : "Starts the clock, then records from the first bar; Stop ends it on the bar"
                  }
                  onClick={() => void record()}
                >
                  {recording ? <LuSquare /> : <LuCircle />}{" "}
                  {armed ? "Cancel" : recording ? "Stop" : "Rec"}
                </Button>
                <Button
                  size="xs"
                  rounded="sm"
                  variant="outline"
                  onClick={() => void clear()}
                  disabled={p.loopName === null || recording}
                  aria-label="Clear loop"
                >
                  <LuEraser />
                </Button>
              </HStack>
              <HStack gap="3" align="center" wrap="nowrap">
                <SegmentGroup.Root
                  size="sm"
                  value={String(p.bars)}
                  disabled={recording}
                  onValueChange={(d) => {
                    if (isBars(d.value)) changeParams(id, { bars: Number(d.value) })
                  }}
                >
                  <SegmentGroup.Indicator />
                  {MIC_BARS.map((b) => (
                    <SegmentGroup.Item
                      key={b}
                      value={String(b)}
                      aria-label={`${b} bar${b === 1 ? "" : "s"}`}
                    >
                      <SegmentGroup.ItemText>{b}</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                  ))}
                </SegmentGroup.Root>
                <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                  bars at most{p.loopName ? ` · taken at ${Math.round(p.loopBpm)} BPM` : ""}
                </Text>
              </HStack>
            </ControlCard>

            <ControlCard title="Takes" minW="0">
              <TakesList
                using={p.loopKey}
                onUse={(take) => void use(take)}
                onDeleted={(key) => {
                  if (key === p.loopKey) clear()
                }}
              />
            </ControlCard>

            {/* The card's own actions go in its footer: the pattern's tools here, the filter's on the next. */}
            <ControlCard title="Level" footer={<PatternTools id={id} kind="mic" />}>
              <HStack gap="4" wrap="wrap">
                <Knob
                  label="Live"
                  value={p.liveLevel}
                  min={MIC_RANGES.liveLevel.min}
                  max={MIC_RANGES.liveLevel.max}
                  step={0.01}
                  defaultValue={MIC_PARAMS_DEFAULT.liveLevel}
                  format={formatPercent}
                  onChange={(liveLevel) => changeParams(id, { liveLevel })}
                />
                <Knob
                  label="Loop"
                  value={p.loopLevel}
                  min={MIC_RANGES.loopLevel.min}
                  max={MIC_RANGES.loopLevel.max}
                  step={0.01}
                  defaultValue={MIC_PARAMS_DEFAULT.loopLevel}
                  format={formatPercent}
                  onChange={(loopLevel) => changeParams(id, { loopLevel })}
                />
              </HStack>
            </ControlCard>

            <ControlCard title="Filter" footer={<FilterTools id={id} heading={false} />}>
              <FilterControls
                heading={false}
                type={p.filterType}
                cutoff={p.cutoff}
                q={p.resonance}
                onTypeChange={(filterType) => changeParams(id, { filterType })}
              />
              <HStack gap="4" wrap="wrap" align="flex-start">
                <Knob
                  label="Cutoff"
                  scale="log"
                  value={p.cutoff}
                  min={MIC_RANGES.cutoff.min}
                  max={MIC_RANGES.cutoff.max}
                  step={1}
                  defaultValue={MIC_PARAMS_DEFAULT.cutoff}
                  format={formatHz}
                  onChange={(cutoff) => changeParams(id, { cutoff })}
                />
                <Knob
                  label="Res"
                  value={p.resonance}
                  min={MIC_RANGES.resonance.min}
                  max={MIC_RANGES.resonance.max}
                  step={0.1}
                  defaultValue={MIC_PARAMS_DEFAULT.resonance}
                  format={formatQ}
                  onChange={(resonance) => changeParams(id, { resonance })}
                />
              </HStack>
            </ControlCard>
          </Grid>
        </VStack>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
