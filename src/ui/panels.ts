import { useBreakpointValue } from "@chakra-ui/react"
import { create } from "zustand"

/** The two panels the toolbar opens. Only one shows at a time. */
export type PanelId = "add" | "songs"

interface PanelState {
  panel: PanelId | null
  /** Open this panel — closing whichever was open — or close it if it is the open one. */
  toggle: (id: PanelId) => void
  close: () => void
}

/**
 * Which side panel is open. UI-only, not persisted: a page load starts with
 * the rack alone. Shared by the toolbar buttons and the panels themselves.
 */
export const usePanelStore = create<PanelState>()((set) => ({
  panel: null,
  toggle: (id) => set((s) => ({ panel: s.panel === id ? null : id })),
  close: () => set({ panel: null }),
}))

/**
 * Whether a panel docks beside the rack (a desktop, from `lg`) instead of
 * sliding over it. Evaluated on the client only; the first render says no.
 */
export const useDocked = (): boolean =>
  useBreakpointValue({ base: false, lg: true }, { ssr: false }) ?? false
