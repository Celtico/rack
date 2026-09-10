import { Flex, HStack, SegmentGroup, Separator, Text, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuSlidersHorizontal } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { instanceLabel } from "../state/instances"
import {
  DELAY_TIMES,
  FX_DEFAULT,
  FX_RANGES,
  useRackStore,
  type DelayTime,
  type FxParams,
} from "../state/store"
import { Fader } from "./Fader"
import { Knob } from "./Knob"
import { LevelMeter } from "./LevelMeter"
import { RackUnit } from "./RackUnit"
import { formatPercent } from "./unitMeta"

const DELAY_LABELS: Record<DelayTime, string> = {
  "16n": "1/16",
  "8n": "1/8",
  "8n.": "1/8·",
  "4n": "1/4",
}

const isDelayTime = (v: string | null): v is DelayTime => DELAY_TIMES.includes(v as DelayTime)
const formatSeconds = (v: number) => `${v.toFixed(1)} s`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack gap="2" align="flex-start">
      <Text textStyle="silkscreen" color="rack.silkscreen.muted">
        {title}
      </Text>
      {children}
    </VStack>
  )
}

/** One mixer strip: meter, fader and FX send of an instance. */
function Strip({ id }: { id: string }) {
  const inst = useRackStore((s) => s.instances.find((i) => i.id === id))
  const all = useRackStore((s) => s.instances)
  const { setInstanceLevel, setInstanceSend } = useRackStore.getState()
  if (!inst) return null
  const label = instanceLabel(inst, all)

  return (
    <Section title={label}>
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
      </HStack>
    </Section>
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
          <Section title="Echo">
            <HStack gap="4" align="flex-start">
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
          </Section>

          <Separator orientation="vertical" borderColor="rack.panel.edge" alignSelf="stretch" />

          <Section title="Reverb">
            <Knob
              size="sm"
              label="Decay"
              scale="log"
              value={fx.reverbDecay}
              min={FX_RANGES.reverbDecay.min}
              max={FX_RANGES.reverbDecay.max}
              step={0.1}
              defaultValue={FX_DEFAULT.reverbDecay}
              format={formatSeconds}
              onChange={changeFx("reverbDecay")}
            />
          </Section>
        </Flex>
      </VStack>
    </RackUnit>
  )
}
