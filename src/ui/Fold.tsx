import { Collapsible } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * The body of a unit or section, folding away with Chakra's collapse
 * animation. The buttons that fold it live in the header, so this is
 * controlled by `open` only — no trigger of its own. A folded body is not
 * mounted at all: a rack of folded units (how it opens) then carries no grids,
 * knobs or per-step playhead work for what nobody sees.
 */
export function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <Collapsible.Root open={open} lazyMount unmountOnExit>
      <Collapsible.Content
        css={{
          // The content clips while it animates; a little bleed keeps the
          // focus rings of controls at the edges from being cut off.
          p: "1.5",
          m: "-1.5",
          _motionReduce: { "&[data-state]": { animation: "none" } },
        }}
      >
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
