import { Button, chakra, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { useRef, useState, type ChangeEvent } from "react"
import { LuCircle, LuEraser, LuPackage, LuSquare, LuUpload } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { instanceLabel, KIND_TITLE, type InstanceOf } from "../state/instances"
import { PAD_IDS, type KitRows, type PadId } from "../state/pattern"
import { PAD_DEFAULT, PAD_RANGES, selectInstance, selectTrack, useRackStore } from "../state/store"
import { Display } from "./Display"
import { StripFilterControls } from "./FilterControls"
import { Knob } from "./Knob"
import { ModPanel } from "./ModPanel"
import { PartTools } from "./PartTools"
import { RackUnit } from "./RackUnit"
import { saveTake } from "../audio/sampleStore"
import { recordClip, type ClipRecording } from "./micRecord"
import { takesChanged } from "./takes"
import { loadFactoryKit } from "./samplerKits"
import { StepGrid } from "./StepGrid"
import { changeParams, formatPercent, formatSeconds, KIND_FINISH, kindIcon } from "./unitMeta"

const padNumber = (pad: PadId) => pad.replace("pad", "")
const shortName = (name: string | null, pad: PadId) =>
  name ? name.replace(/\.[^.]+$/, "").slice(0, 10) : `Pad ${padNumber(pad)}`

const formatSemitones = (v: number) => `${v > 0 ? "+" : ""}${v} st`

/**
 * SMP-8: eight pads with the user's own samples. Audio lives in the browser
 * (IndexedDB, under this instance's keys); the song keeps each pad's name,
 * pitch, decay and level.
 */
export function SamplerUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"sampler"> | undefined
  const track = useRackStore((s) => selectTrack(s, id))
  // A string, so another machine's knob does not re-render this one; it changes only when a sibling comes or goes.
  const label = useRackStore((s) => (inst ? instanceLabel(inst, s.instances) : ""))
  const selected = useRackStore((s) => s.selectedPad[id] ?? "pad1")
  const { toggleStep, selectPad, setInstanceParams } = useRackStore.getState()
  const fileInput = useRef<HTMLInputElement>(null)
  const [loadingKit, setLoadingKit] = useState(false)
  // The clip being taken from the microphone for the selected pad, while Rec is lit.
  const [taking, setTaking] = useState<ClipRecording | null>(null)
  if (!inst || !track || !("rows" in track)) return null

  const pads = inst.params
  const pad = pads[selected]
  const rows = track.rows as KitRows
  const gridRows = PAD_IDS.map((p) => ({
    id: p,
    label: shortName(pads[p].name, p),
    steps: rows[p] ?? [],
  }))

  const changePad = (patch: Partial<typeof pad>) =>
    changeParams(id, { [selected]: { ...pad, ...patch } })

  const pick = (p: PadId) => {
    selectPad(id, p)
    getEngine().triggerHit(id, p)
  }

  // Rec: a clip from the microphone straight onto the selected pad (the browser asks for the
  // microphone the first time); pressed again, or after ten seconds, it stops and the pad has it.
  const record = async () => {
    if (taking) {
      taking.stop()
      return
    }
    const target = selected
    try {
      const clip = await recordClip(`Mic ${padNumber(target)}`)
      setTaking(clip)
      const { name, type, data } = await clip.done
      setTaking(null)
      await getEngine().importSample(id, target, name, data)
      // Onto the pad, and into the list of takes the MIC-1 panel shows.
      await saveTake({ name, data, type })
      takesChanged()
      setInstanceParams(id, { [target]: { ...pads[target], name } })
      toaster.create({
        type: "success",
        title: `Pad ${padNumber(target)} recorded`,
        description: name,
      })
    } catch (err) {
      setTaking(null)
      toaster.create({
        type: "error",
        title: "Could not record",
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      await getEngine().importSample(id, selected, file.name, await file.arrayBuffer())
      setInstanceParams(id, { [selected]: { ...pad, name: file.name } })
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
    await getEngine().clearSample(id, selected)
    setInstanceParams(id, { [selected]: { ...pad, name: null } })
  }

  const loadKit = async () => {
    setLoadingKit(true)
    try {
      await loadFactoryKit(id)
      toaster.create({
        type: "success",
        title: "Kit loaded",
        description: "Eight pads, CC0 one-shots",
      })
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Could not load the kit",
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoadingKit(false)
    }
  }

  return (
    <RackUnit
      id={id}
      model={label}
      title={KIND_TITLE.sampler}
      units={2}
      finish={KIND_FINISH.sampler}
      icon={kindIcon("sampler")}
      instance
    >
      <Flex wrap="wrap" gap={{ base: "5", xl: "8" }} align="stretch">
        <StepGrid rows={gridRows} onToggle={(p, step) => toggleStep(id, p, step)} />

        <Flex
          wrap="wrap"
          gap={{ base: "5", lg: "8" }}
          align="flex-start"
          alignContent="flex-start"
          flex="1 1 20rem"
          minW="0"
        >
          <VStack gap="3" align="flex-start" maxW={{ xl: "64" }}>
            <HStack gap="2" w="full">
              <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                Pad
              </Text>
              {/* Eight CC0 one-shots into the eight pads, so the sampler has something to say out of the box. */}
              <Button
                size="xs"
                rounded="sm"
                variant="subtle"
                ml="auto"
                loading={loadingKit}
                onClick={() => void loadKit()}
              >
                <LuPackage /> Load kit
              </Button>
            </HStack>
            <HStack gap="1" wrap="wrap">
              {PAD_IDS.map((p) => (
                <Button
                  key={p}
                  size="xs"
                  rounded="sm"
                  variant={p === selected ? "solid" : "subtle"}
                  colorPalette={p === selected ? "orange" : "gray"}
                  aria-pressed={p === selected}
                  aria-label={`Select pad ${padNumber(p)}`}
                  onClick={() => pick(p)}
                >
                  {padNumber(p)}
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
                variant={taking ? "solid" : "subtle"}
                colorPalette={taking ? "red" : "gray"}
                aria-pressed={taking !== null}
                aria-label={
                  taking
                    ? "Stop recording"
                    : `Record pad ${padNumber(selected)} from the microphone`
                }
                onClick={() => void record()}
              >
                {taking ? <LuSquare /> : <LuCircle />} {taking ? "Stop" : "Rec"}
              </Button>
              <Button
                size="xs"
                rounded="sm"
                variant="outline"
                onClick={clear}
                disabled={pad.name === null || taking !== null}
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
                label="Pitch"
                value={pad.pitch}
                min={PAD_RANGES.pitch.min}
                max={PAD_RANGES.pitch.max}
                step={1}
                defaultValue={PAD_DEFAULT.pitch}
                format={formatSemitones}
                onChange={(pitch) => changePad({ pitch })}
              />
              <Knob
                label="Decay"
                scale="log"
                value={pad.decay}
                min={PAD_RANGES.decay.min}
                max={PAD_RANGES.decay.max}
                step={0.01}
                defaultValue={PAD_DEFAULT.decay}
                format={formatSeconds}
                onChange={(decay) => changePad({ decay })}
              />
              <Knob
                label="Level"
                value={pad.level}
                min={0}
                max={1}
                step={0.01}
                defaultValue={PAD_DEFAULT.level}
                format={formatPercent}
                onChange={(level) => changePad({ level })}
              />
            </HStack>
          </VStack>
          {inst.filter && <StripFilterControls id={id} filter={inst.filter} />}
          <PartTools id={id} kind="sampler" />
        </Flex>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
