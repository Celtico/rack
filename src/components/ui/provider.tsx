import { ChakraProvider } from "@chakra-ui/react"
import type { ReactNode } from "react"

import { system } from "../../theme/system"

/**
 * The rack is always dark: `index.html` carries `class="dark"` for Chakra's
 * semantic tokens, so no colour-mode provider (and no injected theme script)
 * is needed.
 */
export function Provider({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>
}
