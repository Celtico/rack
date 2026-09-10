import { Flex, HStack, SegmentGroup, Separator, Text, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"

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
import { Knob } from "./Knob"
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

/** FX-2: the mixer strips (level + send per module), the echo and the reverb. */
export function FxUnit() {
  const mix = useRackStore((s) => s.mix)
  const fx = useRackStore((s) => s.fx)
  const { setChannelLevel, setChannelSend, setFxParam } = useRackStore.getState()

  const changeLevel = (channel: ChannelId) => (level: number) => {
    setChannelLevel(channel, level)
    getEngine().setChannelVolume(channel, level)
  }

  const changeSend = (channel: ChannelId) => (level: number) => {
    setChannelSend(channel, level)
    getEngine().setSend(channel, level)
  }

  const changeFx =
    <K extends keyof FxParams>(key: K) =>
    (value: FxParams[K]) => {
      setFxParam(key, value)
      getEngine().setFxParam(key, value)
    }

  return (
    <RackUnit model="FX-2" title="Mix · Echo · Reverb" finish="yellow">
      <Flex wrap="wrap" gap={{ base: "5", md: "8" }} align="stretch">
        {CHANNEL_IDS.map((channel) => (
          <Section key={channel} title={CHANNEL_LABELS[channel]}>
            <HStack gap="4">
              <Knob
                size="sm"
                label="Level"
                value={mix.level[channel]}
                min={0}
                max={1}
                step={0.01}
                defaultValue={MIX_DEFAULT.level[channel]}
                format={formatPercent}
                onChange={changeLevel(channel)}
              />
              <Knob
                size="sm"
                label="Send"
                value={mix.send[channel]}
                min={0}
                max={1}
                step={0.01}
                defaultValue={MIX_DEFAULT.send[channel]}
                format={formatPercent}
                onChange={changeSend(channel)}
              />
            </HStack>
          </Section>
        ))}

        <Separator orientation="vertical" borderColor="rack.panel.edge" alignSelf="stretch" />

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
    </RackUnit>
  )
}
