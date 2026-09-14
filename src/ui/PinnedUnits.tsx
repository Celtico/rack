import { Box, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuLayoutGrid, LuListMusic } from "react-icons/lu"

import { useLayoutStore, type PinnedUnitId } from "../state/layout"
import type { Finish } from "../theme/recipes/rackUnit"
import { MiniBank } from "./MiniBank"
import { MiniSong } from "./MiniSong"
import { PatternBank } from "./PatternBank"
import { RackUnit } from "./RackUnit"
import { TimelineUnit } from "./TimelineUnit"

/** Each panel wears its own finish, like the machines do; the icon takes the finish's accent. */
const PANELS: Record<
  PinnedUnitId,
  {
    model: string
    title: string
    finish: Finish
    icon: ReactNode
    body: ReactNode
    /** In the folded header: the slots, or the chain, as LEDs. */
    preview: ReactNode
  }
> = {
  PATTERN: {
    model: "BANK",
    title: "Patterns",
    finish: "green",
    icon: <LuLayoutGrid />,
    body: <PatternBank />,
    preview: <MiniBank />,
  },
  SONG: {
    model: "SONG",
    title: "Timeline",
    finish: "pink",
    icon: <LuListMusic />,
    body: <TimelineUnit />,
    preview: <MiniSong />,
  },
}

/**
 * The pattern bank and the song timeline as two slim panels under the
 * transport, scrolling with the rack like any other. Pinned: they fold and
 * swap places with each other (grip, drag or menu) but never leave the top.
 */
export function PinnedUnits() {
  const pinnedOrder = useLayoutStore((s) => s.pinnedOrder)
  const hidden = useLayoutStore((s) => s.hidden)
  const shown = pinnedOrder.filter((id) => !hidden.includes(id))
  if (shown.length === 0) return null
  return (
    <Box>
      <VStack gap={{ base: "1", md: "3" }} align="stretch">
        {shown.map((id) => {
          const { model, title, finish, icon, body, preview } = PANELS[id]
          return (
            <RackUnit
              key={id}
              id={id}
              model={model}
              title={title}
              finish={finish}
              icon={icon}
              pinned
              preview={preview}
            >
              {body}
            </RackUnit>
          )
        })}
      </VStack>
    </Box>
  )
}
