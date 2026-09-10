import { chakra, HStack, IconButton, Separator, Text, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuChevronDown, LuChevronUp, LuTimer } from "react-icons/lu"

import { useRackStore, type MasterSectionId } from "../state/store"
import { PatternBank } from "./PatternBank"
import { RackUnit } from "./RackUnit"
import { TimelineUnit } from "./TimelineUnit"
import { Transport } from "./Transport"

/** One row of the top panel: a title line with the fold toggle at the far right, the controls underneath. */
function MasterSection({
  id,
  title,
  children,
}: {
  id: MasterSectionId
  title: string
  children: ReactNode
}) {
  const folded = useRackStore((s) => s.folded[id] === true)
  const { toggleFold } = useRackStore.getState()
  return (
    <VStack as="section" gap="2" align="stretch" minW="0" aria-label={title}>
      <HStack gap="2">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          {title}
        </Text>
        <IconButton
          size="2xs"
          variant="ghost"
          color="rack.silkscreen.muted"
          ml="auto"
          aria-label={folded ? `Expand ${title}` : `Fold ${title}`}
          aria-expanded={!folded}
          _expanded={{ bg: "transparent" }}
          onClick={() => toggleFold(id)}
        >
          {folded ? <LuChevronDown /> : <LuChevronUp />}
        </IconButton>
      </HStack>
      <chakra.div hidden={folded}>{children}</chakra.div>
    </VStack>
  )
}

/**
 * The top panel: transport, pattern bank/file and the song timeline in one
 * unit that is always there — it cannot be folded, moved or removed, but each
 * of its sections can be folded on its own.
 */
export function MasterUnit() {
  return (
    <RackUnit id="TRANSPORT" model="TRANSPORT" title="Clock · Bank · Song" icon={<LuTimer />} fixed>
      {/* One row per section, full width, a rule between them, each with its own fold. */}
      <VStack gap="4" align="stretch" separator={<Separator borderColor="rack.panel.edge" />}>
        <MasterSection id="CLOCK" title="Clock · Master">
          <Transport />
        </MasterSection>
        <MasterSection id="PATTERN" title="Bank · File">
          <PatternBank />
        </MasterSection>
        <MasterSection id="SONG" title="Song">
          <TimelineUnit />
        </MasterSection>
      </VStack>
    </RackUnit>
  )
}
