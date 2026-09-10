import { Box, Button, Container, HStack, Menu, Portal, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuChevronsDownUp, LuChevronsUpDown, LuPlus } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import type { ChannelId } from "../state/channels"
import { useLayoutStore, type UnitId } from "../state/layout"
import { useRackStore } from "../state/store"
import { BassUnit } from "./BassUnit"
import { DrumMachine } from "./DrumMachine"
import { EpUnit } from "./EpUnit"
import { FxUnit } from "./FxUnit"
import { MonoSynth } from "./MonoSynth"
import { PatternBank } from "./PatternBank"
import { PercUnit } from "./PercUnit"
import { PolyUnit } from "./PolyUnit"
import { SamplerUnit } from "./SamplerUnit"
import { StringsUnit } from "./StringsUnit"
import { TimelineUnit } from "./TimelineUnit"
import { Transport } from "./Transport"

const UNITS: Record<UnitId, { element: ReactNode; channel?: ChannelId }> = {
  TRANSPORT: { element: <Transport /> },
  PATTERN: { element: <PatternBank /> },
  SONG: { element: <TimelineUnit /> },
  "DR-4": { element: <DrumMachine />, channel: "drums" },
  "PERC-6": { element: <PercUnit />, channel: "perc" },
  "SMP-8": { element: <SamplerUnit />, channel: "sampler" },
  "BASS-2": { element: <BassUnit />, channel: "bass" },
  "MONO-1": { element: <MonoSynth />, channel: "synth" },
  "POLY-4": { element: <PolyUnit />, channel: "poly" },
  "EP-1": { element: <EpUnit />, channel: "ep" },
  "STR-6": { element: <StringsUnit />, channel: "strings" },
  "FX-2": { element: <FxUnit /> },
}

/** The rack itself: the modules in the user's order, with a small toolbar above. */
export function Rack() {
  const order = useLayoutStore((s) => s.order)
  const hidden = useLayoutStore((s) => s.hidden)
  const { showUnit } = useLayoutStore.getState()
  const { setFolded, setChannelMute } = useRackStore.getState()

  const visible = order.filter((id) => !hidden.includes(id))

  const add = (id: UnitId) => {
    showUnit(id)
    const channel = UNITS[id].channel
    if (channel) {
      setChannelMute(channel, false)
      getEngine().setChannelMute(channel, false)
    }
  }

  return (
    <Container as="main" maxW="8xl" px={{ base: "2", md: "6" }} py={{ base: "4", md: "8" }}>
      <HStack gap="2" mb="3" justify="flex-end" wrap="wrap">
        <Button size="xs" variant="subtle" rounded="sm" onClick={() => setFolded(visible, true)}>
          <LuChevronsDownUp /> Fold all
        </Button>
        <Button size="xs" variant="subtle" rounded="sm" onClick={() => setFolded(visible, false)}>
          <LuChevronsUpDown /> Unfold all
        </Button>
        <Menu.Root onSelect={(details) => add(details.value as UnitId)}>
          <Menu.Trigger asChild>
            <Button size="xs" variant="subtle" rounded="sm" disabled={hidden.length === 0}>
              <LuPlus /> Add unit
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {hidden.map((id) => (
                  <Menu.Item key={id} value={id}>
                    {id}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      <Box
        bg="rack.frame"
        borderXWidth={{ base: "6px", md: "10px" }}
        borderColor="rack.rail"
        rounded="md"
        p={{ base: "2", md: "3" }}
        shadow="panel"
      >
        <VStack gap={{ base: "2", md: "3" }} align="stretch">
          {visible.map((id) => (
            <Box key={id}>{UNITS[id].element}</Box>
          ))}
        </VStack>
      </Box>
    </Container>
  )
}
