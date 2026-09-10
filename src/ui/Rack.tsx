import { Box, Container, VStack } from "@chakra-ui/react"

import { DrumMachine } from "./DrumMachine"
import { FxUnit } from "./FxUnit"
import { MonoSynth } from "./MonoSynth"
import { PatternBank } from "./PatternBank"
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
          <MonoSynth />
          <FxUnit />
        </VStack>
      </Box>
    </Container>
  )
}
