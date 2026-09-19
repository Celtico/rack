import {
  Box,
  Button,
  chakra,
  Flex,
  HStack,
  SegmentGroup,
  Slider,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { LuEraser, LuUpload } from "react-icons/lu"

import { toaster } from "../components/ui/toaster"
import { errorText, errorToast } from "./errors"
import { ControlGroup } from "./ControlGroup"
import { KIND_TITLE, type InstanceOf } from "../state/instances"
import {
  selectInstance,
  useRackStore,
  VIDEO_BARS,
  VIDEO_PARAMS_DEFAULT,
  VIDEO_RANGES,
  type VideoBars,
} from "../state/store"
import { formatHz, formatPercent, formatQ, formatTime } from "./format"
import { Display } from "./Display"
import { FilterControls } from "./FilterControls"
import { Knob } from "./Knob"
import { ModPanel } from "./ModPanel"
import { PartTools } from "./PartTools"
import { RackUnit } from "./RackUnit"
import { GateGrid } from "./TrackGrids"
import { changeParams, KIND_FINISH, kindIcon, isNumberOption, useInstanceLabel } from "./unitMeta"
import {
  clearVideo,
  convertVideo,
  importVideo,
  previewAt,
  regionEnd,
  STRIP_FRAMES,
  STRIP_SIZE,
  subscribeStrip,
  UPLOAD_HEIGHT,
  uploadFormat,
  type ConvertOptions,
  type Strip,
  type VideoFormat,
} from "./videoLoops"

const isBars = isNumberOption(VIDEO_BARS)

/**
 * The trimmer, as in a video editor: a filmstrip of the whole file with two
 * handles on it for the loop's in and out points. Dragging a handle while
 * the clock is stopped shows that frame on the screen.
 */
function Trimmer({ id, start, end }: { id: string; start: number; end: number }) {
  const [strip, setStrip] = useState<Strip | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => subscribeStrip(id, setStrip), [id])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = STRIP_FRAMES * STRIP_SIZE
    canvas.height = STRIP_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (strip) ctx.drawImage(strip.canvas, 0, 0)
  }, [strip])
  const duration = strip?.duration ?? 0
  const out = regionEnd(end, duration)
  const values: [number, number] = [Math.min(start, out), out]

  return (
    <VStack gap="1" align="stretch" w="full">
      <HStack justify="space-between">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          Trim
        </Text>
        <Text textStyle="display" fontSize="xs" color="rack.display.fg">
          {formatTime(values[0])} – {formatTime(values[1])}
          {duration > 0 ? ` / ${formatTime(duration)}` : ""}
        </Text>
      </HStack>
      <Box position="relative" w="full" h="8">
        {/* The film: every thumbnail is a square of the middle of its frame, pixels kept hard. */}
        <chakra.canvas
          ref={canvasRef}
          position="absolute"
          inset="0"
          w="full"
          h="full"
          rounded="xs"
          bg="rack.display.bg"
          css={{ imageRendering: "pixelated" }}
          aria-hidden="true"
        />
        <Slider.Root
          min={0}
          max={duration || 1}
          step={0.05}
          value={values}
          disabled={duration === 0}
          onValueChange={(d) => {
            const [a, b] = d.value
            if (a === undefined || b === undefined) return
            // The handle that moved is the frame to show.
            previewAt(id, a !== values[0] ? a : b)
            changeParams(id, { start: a, end: b >= duration - 0.05 ? 0 : b })
          }}
          position="absolute"
          inset="0"
          size="sm"
          colorPalette="orange"
          aria-label={["Loop start", "Loop end"]}
        >
          <Slider.Control h="full">
            <Slider.Track bg="transparent" h="full" rounded="xs">
              {/* The kept region: clear; what is cut: shaded. */}
              <Slider.Range bg="transparent" outline="2px solid" outlineColor="rack.led.on" />
            </Slider.Track>
            {[0, 1].map((i) => (
              <Slider.Thumb
                key={i}
                index={i}
                w="2.5"
                h="full"
                rounded="xs"
                bg="rack.led.on"
                borderWidth="0"
                _focus={{ outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "2px" }}
              >
                <Slider.HiddenInput />
              </Slider.Thumb>
            ))}
          </Slider.Control>
        </Slider.Root>
      </Box>
    </VStack>
  )
}

/**
 * VID-1: a video loop whose soundtrack is the instrument. The file lives in
 * the browser; the loop runs with the clock and starts over every N bars;
 * its sound passes the gate row, the machine's filter, then drive and FX like
 * any other. The frame's brightness can push the cutoff.
 */
export function VideoUnit({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id)) as InstanceOf<"video"> | undefined
  const label = useInstanceLabel(inst)
  const fileInput = useRef<HTMLInputElement>(null)
  if (!inst) return null
  const p = inst.params

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      await importVideo(id, file.name, file.type, await file.arrayBuffer())
      changeParams(id, { videoName: file.name })
      // Straight into a small MP4 (or WebM where MP4 cannot be written): light on a phone, plays anywhere.
      const format = uploadFormat()
      if (format) await convert(format, UPLOAD_HEIGHT, false)
      else toaster.create({ type: "success", title: "Video loaded", description: file.name })
    } catch (err) {
      errorToast("Could not load the video", err)
    }
  }
  const clear = async () => {
    await clearVideo(id)
    changeParams(id, { videoName: null })
  }
  // Re-encode in the browser, with a toast that counts the seconds; the file plays once, silently.
  const convert = async (
    format: VideoFormat,
    height: ConvertOptions["height"],
    region: boolean,
  ) => {
    const toastId = toaster.create({
      type: "loading",
      title: `Converting to ${format.label} · ${height}p`,
      description: "0 %",
    })
    try {
      const name = await convertVideo(id, {
        format,
        height,
        region,
        onProgress: (f) =>
          toaster.update(toastId, {
            type: "loading",
            title: `Converting to ${format.label} · ${height}p`,
            description: `${Math.round(f * 100)} %`,
          }),
      })
      changeParams(id, { videoName: name })
      toaster.update(toastId, { type: "success", title: "Video ready", description: name })
    } catch (err) {
      toaster.update(toastId, {
        type: "error",
        title: "Could not convert",
        description: errorText(err),
      })
    }
  }

  return (
    <RackUnit
      id={id}
      model={label}
      title={KIND_TITLE.video}
      units={3}
      finish={KIND_FINISH.video}
      icon={kindIcon("video")}
      instance
    >
      <Flex wrap="wrap" gap={{ base: "5", lg: "8" }} align="stretch">
        {/* The gate row and, under it, the trimmer as wide as the row. */}
        <VStack gap="3" align="stretch" minW="0" flex="0 1 auto">
          <GateGrid id={id} />
          <Trimmer id={id} start={p.start} end={p.end} />
        </VStack>

        <Flex
          wrap="wrap"
          gap={{ base: "5", lg: "8" }}
          align="flex-start"
          alignContent="flex-start"
          flex="1 1 20rem"
          minW="0"
        >
          <ControlGroup title="Video">
            <HStack gap="2" wrap="wrap">
              <Display tone="amber" minW="28">
                {p.videoName ? p.videoName.replace(/\.[^.]+$/, "").slice(0, 16) : "— empty —"}
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
                onClick={() => void clear()}
                disabled={p.videoName === null}
                aria-label="Clear video"
              >
                <LuEraser />
              </Button>
              <chakra.input
                ref={fileInput}
                type="file"
                accept="video/*,.mov,.mp4,.webm"
                onChange={(e) => void load(e)}
                srOnly
                aria-label="Load video file"
              />
            </HStack>
            <HStack gap="3" align="center" wrap="nowrap">
              <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                Loop
              </Text>
              <SegmentGroup.Root
                size="sm"
                value={String(p.bars)}
                onValueChange={(d) => {
                  if (isBars(d.value)) changeParams(id, { bars: Number(d.value) as VideoBars })
                }}
              >
                <SegmentGroup.Indicator />
                {VIDEO_BARS.map((b) => (
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
                bars
              </Text>
            </HStack>
          </ControlGroup>

          <FilterControls
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
              min={VIDEO_RANGES.cutoff.min}
              max={VIDEO_RANGES.cutoff.max}
              step={1}
              defaultValue={VIDEO_PARAMS_DEFAULT.cutoff}
              format={formatHz}
              onChange={(cutoff) => changeParams(id, { cutoff })}
            />
            <Knob
              label="Res"
              value={p.resonance}
              min={VIDEO_RANGES.resonance.min}
              max={VIDEO_RANGES.resonance.max}
              step={0.1}
              defaultValue={VIDEO_PARAMS_DEFAULT.resonance}
              format={formatQ}
              onChange={(resonance) => changeParams(id, { resonance })}
            />
            <Knob
              label="Video→cut"
              value={p.toCutoff}
              min={VIDEO_RANGES.toCutoff.min}
              max={VIDEO_RANGES.toCutoff.max}
              step={0.01}
              defaultValue={VIDEO_PARAMS_DEFAULT.toCutoff}
              format={formatPercent}
              onChange={(toCutoff) => changeParams(id, { toCutoff })}
            />
          </HStack>
          <PartTools id={id} kind="video" />
        </Flex>
      </Flex>
      <ModPanel id={id} />
    </RackUnit>
  )
}
