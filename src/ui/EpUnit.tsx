import { Flex, HStack, VStack } from "@chakra-ui/react"

import { getEngine } from "../audio/engine"
import { EP_PARAMS_DEFAULT, EP_RANGES, useRackStore, type EpParams } from "../state/store"
import { Knob } from "./Knob"
import { PolyGrid } from "./PolyGrid"
import { RackUnit } from "./RackUnit"

const formatRatio = (v: number) => `${v.toFixed(2)}×`
const formatIndex = (v: number) => v.toFixed(1)
const formatSeconds = (v: number) => `${v.toFixed(2)} s`

/** EP-1: FM electric piano. */
export function EpUnit() {
  const params = useRackStore((s) => s.epParams)
  const { setEpParam } = useRackStore.getState()

  const change =
    <K extends keyof EpParams>(key: K) =>
    (value: EpParams[K]) => {
      setEpParam(key, value)
      getEngine().setEpParam(key, value)
    }

  return (
    <RackUnit model="EP-1" title="Electric piano" units={3}>
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <PolyGrid instrument="ep" />

        <VStack gap="4" align="flex-start" flexShrink={0}>
          <HStack gap="4" wrap="wrap" align="flex-start" maxW={{ lg: "56" }}>
            <Knob
              label="Tone"
              value={params.tone}
              min={EP_RANGES.tone.min}
              max={EP_RANGES.tone.max}
              step={0.01}
              defaultValue={EP_PARAMS_DEFAULT.tone}
              format={formatRatio}
              onChange={change("tone")}
            />
            <Knob
              label="Bright"
              value={params.bright}
              min={EP_RANGES.bright.min}
              max={EP_RANGES.bright.max}
              step={0.1}
              defaultValue={EP_PARAMS_DEFAULT.bright}
              format={formatIndex}
              onChange={change("bright")}
            />
            <Knob
              label="Decay"
              scale="log"
              value={params.decay}
              min={EP_RANGES.decay.min}
              max={EP_RANGES.decay.max}
              step={0.01}
              defaultValue={EP_PARAMS_DEFAULT.decay}
              format={formatSeconds}
              onChange={change("decay")}
            />
            <Knob
              label="Release"
              scale="log"
              value={params.release}
              min={EP_RANGES.release.min}
              max={EP_RANGES.release.max}
              step={0.01}
              defaultValue={EP_PARAMS_DEFAULT.release}
              format={formatSeconds}
              onChange={change("release")}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
