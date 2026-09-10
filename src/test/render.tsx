import { ChakraProvider } from "@chakra-ui/react"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

import { system } from "../theme/system"

function Wrapper({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>
}

/** `render` with the project's Chakra system in place. */
export function renderWithChakra(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: Wrapper, ...options })
}
