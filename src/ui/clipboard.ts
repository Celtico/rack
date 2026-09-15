import { create } from "zustand"

import type { Track } from "../state/pattern"

/** What "Copy part" took: one machine's track from one bank slot, and where it came from. */
export interface CopiedPart {
  track: Track
  /** "DR-4 #2 · pattern 3", for the menu and the toast. */
  from: string
}

interface ClipboardState {
  part: CopiedPart | null
  setPart: (part: CopiedPart) => void
}

/** The rack's clipboard for parts. UI-only: it does not survive a reload. */
export const useClipboardStore = create<ClipboardState>()((set) => ({
  part: null,
  setPart: (part) => set({ part }),
}))
