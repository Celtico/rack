import { chakra, Container, Flex, useRecipe, VStack } from "@chakra-ui/react"

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

/** One wooden cheek of the rack. */
function Rail() {
  const recipe = useRecipe({ key: "rail" })
  return <chakra.div css={recipe()} aria-hidden="true" />
}

/** The rack itself: two wooden rails with the modules bolted between them. */
export function Rack() {
  return (
    <Container as="main" maxW="8xl" px={{ base: "2", md: "6" }} py={{ base: "4", md: "8" }}>
      <Flex
        gap={{ base: "1", md: "2" }}
        align="stretch"
        bg="rack.frame"
        rounded="md"
        shadow="panel"
      >
        <Rail />
        <VStack
          flex="1"
          minW="0"
          gap={{ base: "2", md: "3" }}
          align="stretch"
          py={{ base: "2", md: "3" }}
        >
          <Transport />
          <PatternBank />
          <TimelineUnit />
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
        <Rail />
      </Flex>
    </Container>
  )
}
