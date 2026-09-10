import { Box, Container, VStack } from "@chakra-ui/react"

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
import { Transport } from "./Transport"

/** The rack itself: two rails with the modules stacked between them. */
export function Rack() {
  return (
    <Container as="main" maxW="5xl" px={{ base: "3", md: "6" }} py={{ base: "4", md: "8" }}>
      <Box
        bg="rack.frame"
        borderXWidth={{ base: "6px", md: "10px" }}
        borderColor="rack.rail"
        rounded="md"
        p={{ base: "2", md: "3" }}
        shadow="panel"
      >
        <VStack gap={{ base: "2", md: "3" }} align="stretch">
          <Transport />
          <PatternBank />
          <DrumMachine />
          <PercUnit />
          <SamplerUnit />
          <BassUnit />
          <MonoSynth />
          <PolyUnit />
          <EpUnit />
          <StringsUnit />
          <FxUnit />
        </VStack>
      </Box>
    </Container>
  )
}
