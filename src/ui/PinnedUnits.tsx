import { Box, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuLayoutGrid, LuListMusic } from "react-icons/lu"

import { useLayoutStore, type PinnedUnitId } from "../state/layout"
import type { Finish } from "../theme/recipes/rackUnit"
import { PatternBank } from "./PatternBank"
import { RackUnit } from "./RackUnit"
import { TimelineUnit } from "./TimelineUnit"

/** Each panel wears its own finish, like the machines do; the icon takes the finish's accent. */
const PANELS: Record<
  PinnedUnitId,
  { model: string; title: string; finish: Finish; icon: ReactNode; body: ReactNode }
> = {
  PATTERN: {
    model: "BANK",
    title: "Patterns",
    finish: "green",
    icon: <LuLayoutGrid />,
    body: <PatternBank />,
  },
  SONG: {
    model: "SONG",
    title: "Timeline",
    finish: "pink",
    icon: <LuListMusic />,
    body: <TimelineUnit />,
  },
}

/**
 * The pattern bank and the song timeline as two slim panels under the
 * transport, stuck together to the top of the viewport while the rack
 * scrolls, so a slot or a bar can be picked from any machine's grid. Pinned:
 * they fold and swap places with each other (grip, drag or menu) but never
 * leave. One sticky box holds both, so the second stacks under the first
 * instead of covering it.
 */
export function PinnedUnits() {
  const pinnedOrder = useLayoutStore((s) => s.pinnedOrder)
  const hidden = useLayoutStore((s) => s.hidden)
  const shown = pinnedOrder.filter((id) => !hidden.includes(id))
  if (shown.length === 0) return null
  return (
    <Box position="sticky" top="0" zIndex="sticky">
      <VStack gap={{ base: "1", md: "3" }} align="stretch">
        {shown.map((id) => {
          const { model, title, finish, icon, body } = PANELS[id]
          return (
            <RackUnit
              key={id}
              id={id}
              model={model}
              title={title}
              finish={finish}
              icon={icon}
              pinned
            >
              {body}
            </RackUnit>
          )
        })}
      </VStack>
    </Box>
  )
}
