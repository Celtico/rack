import { Flex, HStack, VStack } from "@chakra-ui/react"
import { LuGuitar } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import {
  STRINGS_PARAMS_DEFAULT,
  STRINGS_RANGES,
  useRackStore,
  type StringsParams,
} from "../state/store"
import { Knob } from "./Knob"
import { PolyGrid } from "./PolyGrid"
import { RackUnit } from "./RackUnit"

const formatHz = (v: number) => `${Math.round(v)} Hz`
const formatSustain = (v: number) => v.toFixed(3)
const formatSeconds = (v: number) => `${v.toFixed(2)} s`

/** STR-6: six plucked strings. */
export function StringsUnit() {
  const params = useRackStore((s) => s.stringsParams)
  const { setStringsParam } = useRackStore.getState()

  const change =
    <K extends keyof StringsParams>(key: K) =>
    (value: StringsParams[K]) => {
      setStringsParam(key, value)
      getEngine().setStringsParam(key, value)
    }

  return (
    <RackUnit
      model="STR-6"
      title="Guitar"
      units={3}
      finish="wood"
      channel="strings"
      icon={<LuGuitar />}
    >
      <Flex direction={{ base: "column", lg: "row" }} gap={{ base: "5", lg: "8" }} align="stretch">
        <PolyGrid instrument="strings" />

        <VStack gap="4" align="flex-start" flexShrink={0}>
          <HStack gap="4" wrap="wrap" align="flex-start" maxW={{ lg: "56" }}>
            <Knob
              label="Damp"
              scale="log"
              value={params.damp}
              min={STRINGS_RANGES.damp.min}
              max={STRINGS_RANGES.damp.max}
              step={1}
              defaultValue={STRINGS_PARAMS_DEFAULT.damp}
              format={formatHz}
              onChange={change("damp")}
            />
            <Knob
              label="Sustain"
              value={params.sustain}
              min={STRINGS_RANGES.sustain.min}
              max={STRINGS_RANGES.sustain.max}
              step={0.001}
              defaultValue={STRINGS_PARAMS_DEFAULT.sustain}
              format={formatSustain}
              onChange={change("sustain")}
            />
            <Knob
              label="Release"
              scale="log"
              value={params.release}
              min={STRINGS_RANGES.release.min}
              max={STRINGS_RANGES.release.max}
              step={0.01}
              defaultValue={STRINGS_PARAMS_DEFAULT.release}
              format={formatSeconds}
              onChange={change("release")}
            />
          </HStack>
        </VStack>
      </Flex>
    </RackUnit>
  )
}
