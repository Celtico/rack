import { getEngine } from "../audio/engine"
import { parseSong } from "../state/song"
import { foldedAll, useRackStore } from "../state/store"

/** The factory song, served from `public/` so it can be swapped without a rebuild. */
export const DEFAULT_SONG_URL = `${import.meta.env.BASE_URL}-rack-song.json`

let pending: Promise<boolean> | null = null

/**
 * Load the factory song into the store once. Resolves to false — leaving the
 * built-in starter groove in place — when the file is missing or unreadable.
 */
export function loadDefaultSong(): Promise<boolean> {
  pending ??= (async () => {
    try {
      const res = await fetch(DEFAULT_SONG_URL, { cache: "no-cache" })
      if (!res.ok) return false
      useRackStore.getState().loadSong(parseSong(await res.text()))
      getEngine().syncFromStore()
      // The factory song opens folded; a song the user loads opens its machines instead.
      const s = useRackStore.getState()
      useRackStore.setState({ folded: foldedAll(s.instances.map((i) => i.id)) })
      return true
    } catch (err) {
      console.warn("rack: default song not loaded —", err instanceof Error ? err.message : err)
      return false
    }
  })()
  return pending
}

/** Test hook: forget the cached attempt. */
export function resetDefaultSong(): void {
  pending = null
}
