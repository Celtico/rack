import { Flex, HStack, SegmentGroup, Separator, Text, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuSlidersHorizontal } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { CHANNEL_IDS, CHANNEL_LABELS, type ChannelId } from "../state/channels"
import {
  DELAY_TIMES,
  FX_DEFAULT,
  FX_RANGES,
  MIX_DEFAULT,
  useRackStore,
  type DelayTime,
  type FxParams,
} from "../state/store"
import { Fader } from "./Fader"
import { Knob } from "./Knob"
import { LevelMeter } from "./LevelMeter"
import { RackUnit } from "./RackUnit"

const DELAY_LABELS: Record<DelayTime, string> = {
  "16n": "1/16",
  "8n": "1/8",
  "8n.": "1/8·",
  "4n": "1/4",
}

const isDelayTime = (v: string | null): v is DelayTime => DELAY_TIMES.includes(v as DelayTime)

const formatPercent = (v: number) => `${Math.round(v * 100)}%`
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

/** One mixer strip: meter, fader and FX send. */
function Strip({ channel }: { channel: ChannelId }) {
  const level = useRackStore((s) => s.mix.level[channel])
  const send = useRackStore((s) => s.mix.send[channel])
  const { setChannelLevel, setChannelSend } = useRackStore.getState()

  return (
    <Section title={CHANNEL_LABELS[channel]}>
      <HStack gap="2" align="flex-end">
        <LevelMeter source={channel} label={`${CHANNEL_LABELS[channel]} level`} size="sm" />
        <Fader
          label="Level"
          value={level}
          onChange={(v) => {
            setChannelLevel(channel, v)
            getEngine().setChannelVolume(channel, v)
          }}
        />
        <Knob
          size="sm"
          label="Send"
          value={send}
          min={0}
          max={1}
          step={0.01}
          defaultValue={MIX_DEFAULT.send[channel]}
          format={formatPercent}
          onChange={(v) => {
            setChannelSend(channel, v)
            getEngine().setSend(channel, v)
          }}
        />
      </HStack>
    </Section>
  )
}

/** FX-2: the mixer strips (meter, fader, send per module), the echo and the reverb. */
export function FxUnit() {
  const fx = useRackStore((s) => s.fx)
  const { setFxParam } = useRackStore.getState()

  const changeFx =
    <K extends keyof FxParams>(key: K) =>
    (value: FxParams[K]) => {
      setFxParam(key, value)
      getEngine().setFxParam(key, value)
    }

  return (
    <RackUnit
      model="FX-2"
      title="Mix · Echo · Reverb"
      finish="yellow"
      icon={<LuSlidersHorizontal />}
    >
      <VStack gap="6" align="stretch">
        <Flex wrap="wrap" gap={{ base: "4", md: "6" }} align="flex-end">
          {CHANNEL_IDS.map((channel) => (
            <Strip key={channel} channel={channel} />
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
