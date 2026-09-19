import { Box, Button, Flex, HStack, SegmentGroup, Separator, Text, VStack } from "@chakra-ui/react"
import { LuHeadphones, LuRepeat, LuSlidersHorizontal } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import {
  DELAY_TIMES,
  FX_DEFAULT,
  FX_RANGES,
  PAN_RANGE,
  SPACE_DEFAULT,
  SPACE_RANGES,
  selectInstance,
  useRackStore,
  type DelayTime,
  type FxParams,
} from "../state/store"
import { instanceLabel } from "../state/instances"
import { formatAngle, formatPan, formatPercent, formatSeconds } from "./format"
import { ControlGroup } from "./ControlGroup"
import { Fader } from "./Fader"
import { Knob } from "./Knob"
import { LevelMeter } from "./LevelMeter"
import { finishAccent } from "../theme/recipes/rackUnit"
import { RackUnit } from "./RackUnit"
import { KIND_FINISH, kindIcon, useInstanceLabel } from "./unitMeta"

const DELAY_LABELS: Record<DelayTime, string> = {
  "16n": "1/16",
  "8n": "1/8",
  "8n.": "1/8·",
  "4n": "1/4",
}

const isDelayTime = (v: string | null): v is DelayTime => DELAY_TIMES.includes(v as DelayTime)

/** One mixer strip, on a card of its own: the machine's icon and name, then meter, fader and FX send. */
function Strip({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id))
  const label = useInstanceLabel(inst)
  const { setInstanceLevel, setInstanceSend, setInstancePan, setInstanceSpace } =
    useRackStore.getState()
  const space = useRackStore((s) => s.fx.space)
  if (!inst) return null

  return (
    <VStack
      gap="2"
      align="flex-start"
      p="3"
      rounded="sm"
      bg="blackAlpha.300"
      borderWidth="1px"
      borderColor="rack.panel.divider"
      role="group"
      aria-label={label}
    >
      <HStack gap="2">
        <Box
          as="span"
          display="inline-flex"
          fontSize="lg"
          color={finishAccent(KIND_FINISH[inst.kind])}
          aria-hidden="true"
        >
          {kindIcon(inst.kind)}
        </Box>
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          {label}
        </Text>
      </HStack>
      <HStack gap="2" align="flex-end">
        <LevelMeter source={id} label={`${label} level`} size="sm" />
        <Fader
          label="Level"
          value={inst.level}
          onChange={(v) => {
            setInstanceLevel(id, v)
            getEngine().setInstanceLevel(id, v)
          }}
        />
        <Knob
          size="sm"
          label="Send"
          value={inst.send}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.3}
          format={formatPercent}
          onChange={(v) => {
            setInstanceSend(id, v)
            getEngine().setInstanceSend(id, v)
          }}
        />
        <Knob
          size="sm"
          label="Pan"
          value={inst.pan}
          min={PAN_RANGE.min}
          max={PAN_RANGE.max}
          step={0.01}
          defaultValue={0}
          format={formatPan}
          onChange={(v) => {
            setInstancePan(id, v)
            getEngine().setInstancePan(id, v)
          }}
        />
        {/* In 3D mode the machine also has a place around the listener. */}
        {space && (
          <>
            <Knob
              size="sm"
              label="Angle"
              value={inst.space.angle}
              min={SPACE_RANGES.angle.min}
              max={SPACE_RANGES.angle.max}
              step={5}
              defaultValue={SPACE_DEFAULT.angle}
              format={formatAngle}
              onChange={(angle) => {
                setInstanceSpace(id, { angle })
                getEngine().setInstanceSpace(id, { ...inst.space, angle })
              }}
            />
            <Knob
              size="sm"
              label="Dist"
              value={inst.space.distance}
              min={SPACE_RANGES.distance.min}
              max={SPACE_RANGES.distance.max}
              step={0.01}
              defaultValue={SPACE_DEFAULT.distance}
              format={formatPercent}
              onChange={(distance) => {
                setInstanceSpace(id, { distance })
                getEngine().setInstanceSpace(id, { ...inst.space, distance })
              }}
            />
          </>
        )}
      </HStack>
    </VStack>
  )
}

/** FX-2: a mixer strip per machine (meter, fader, send), the echo and the reverb. */
export function FxUnit() {
  const fx = useRackStore((s) => s.fx)
  // Select the list itself: a mapped array would be a fresh value every render.
  const instances = useRackStore((s) => s.instances)
  const ids = instances.map((i) => i.id)
  const { setFxParam } = useRackStore.getState()

  const changeFx =
    <K extends keyof FxParams>(key: K) =>
    (value: FxParams[K]) => {
      setFxParam(key, value)
      getEngine().setFxParam(key, value)
    }

  return (
    <RackUnit
      id="FX-2"
      model="FX-2"
      title="Mix · Echo · Reverb"
      finish="yellow"
      icon={<LuSlidersHorizontal />}
      preview={
        <HStack gap="1.5">
          {instances.map((inst) => (
            <LevelMeter
              key={inst.id}
              source={inst.id}
              label={`${instanceLabel(inst, instances)} level`}
              size="sm"
              orientation="horizontal"
            />
          ))}
        </HStack>
      }
    >
      <VStack gap="6" align="stretch">
        <Flex wrap="wrap" gap={{ base: "4", md: "6" }} align="flex-end">
          {ids.map((id) => (
            <Strip key={id} id={id} />
          ))}
        </Flex>

        <Flex wrap="wrap" gap={{ base: "5", md: "8" }} align="stretch">
          <ControlGroup title="Echo">
            <HStack gap="4" align="flex-start" wrap="wrap">
              <SegmentGroup.Root
                size="sm"
                value={fx.delayTime}
                onValueChange={(details) => {
                  if (isDelayTime(details.value)) changeFx("delayTime")(details.value)
                }}
              >
                <SegmentGroup.Indicator />
                {DELAY_TIMES.map((t) => (
                  <SegmentGroup.Item key={t} value={t}>
                    <SegmentGroup.ItemText>{DELAY_LABELS[t]}</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                ))}
              </SegmentGroup.Root>
              <Knob
                size="sm"
                label="Feedback"
                value={fx.feedback}
                min={FX_RANGES.feedback.min}
                max={FX_RANGES.feedback.max}
                step={0.01}
                defaultValue={FX_DEFAULT.feedback}
                format={formatPercent}
                onChange={changeFx("feedback")}
              />
            </HStack>
          </ControlGroup>

          <Separator
            orientation="vertical"
            borderColor="rack.panel.edge"
            alignSelf="stretch"
            // Once the sections stack, a vertical rule between them is just a stray line.
            hideBelow="md"
          />

          <ControlGroup title="Reverb">
            <Knob
              size="sm"
              label="Decay"
              scale="log"
              value={fx.reverbDecay}
              min={FX_RANGES.reverbDecay.min}
              max={FX_RANGES.reverbDecay.max}
              step={0.1}
              defaultValue={FX_DEFAULT.reverbDecay}
              format={(v) => formatSeconds(v, 1)}
              onChange={changeFx("reverbDecay")}
            />
          </ControlGroup>

          <Separator
            orientation="vertical"
            borderColor="rack.panel.edge"
            alignSelf="stretch"
            hideBelow="md"
          />

          {/* Both off by default: a song made before them sounds as it did. */}
          <ControlGroup title="Stereo">
            <HStack gap="2" wrap="wrap">
              <Button
                size="xs"
                rounded="sm"
                variant={fx.pingPong ? "solid" : "outline"}
                colorPalette={fx.pingPong ? "orange" : "gray"}
                aria-pressed={fx.pingPong}
                title="The echo bounces between left and right"
                onClick={() => changeFx("pingPong")(!fx.pingPong)}
              >
                <LuRepeat /> Ping-pong echo
              </Button>
              <Button
                size="xs"
                rounded="sm"
                variant={fx.space ? "solid" : "outline"}
                colorPalette={fx.space ? "orange" : "gray"}
                aria-pressed={fx.space}
                title="Every machine at its angle and distance around you — for headphones"
                onClick={() => changeFx("space")(!fx.space)}
              >
                <LuHeadphones /> 3D
              </Button>
            </HStack>
          </ControlGroup>
        </Flex>
      </VStack>
    </RackUnit>
  )
}
