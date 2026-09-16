import { chakra, HStack, useSlotRecipe } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * The rack's first panel: a strip of the same metal as the units holding the
 * global buttons (fold all, add unit, songs). Right-aligned on a desktop; on a
 * phone the buttons share the width and the panel reaches up under the status
 * bar, so nothing shows black above it.
 */
export function ToolbarPanel({ children }: { children: ReactNode }) {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe()
  return (
    <chakra.section
      css={styles.root}
      aria-label="Toolbar"
      // A unit's minimum height is for controls; this strip is only as tall as its buttons.
      minH="0"
      // The panel shadow's 1 px inset highlight sits at the very top of a phone's screen, under the
      // status bar, where it reads as a stray bright line: this first panel goes without it there.
      shadow={{ base: "none", md: "panel" }}
      // Plain black, not the units' graphite with its glow: the strip reads as the frame, not a module.
      bg="black"
      bgImage="none"
      pt={{ base: "max(50px, env(safe-area-inset-top))", md: "3" }}
      pb={{ base: "2", md: "3" }}
    >
      <HStack gap="2" justify={{ base: "stretch", md: "flex-end" }}>
        {children}
      </HStack>
    </chakra.section>
  )
}
