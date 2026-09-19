import { Text, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * A group of controls under a small silkscreen title — the unit of every
 * panel's controls row (Wave, Filter, Envelope, Level, Key…). Without a
 * title it is just the column, for a card that already carries the name.
 */
export function ControlGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <VStack gap="2" align="flex-start">
      {title && <GroupTitle>{title}</GroupTitle>}
      {children}
    </VStack>
  )
}

/** The silkscreen title alone, for a group laid out on its own. */
function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <Text textStyle="silkscreen" color="rack.silkscreen.muted">
      {children}
    </Text>
  )
}
