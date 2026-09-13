import { getEngine } from "../audio/engine"
import { parseSong, type Song } from "../state/song"
import { builtinKey, useLibraryStore } from "../state/songLibrary"
import { foldedAll, useRackStore } from "../state/store"

/** The factory song, served from `public/` so it can be swapped without a rebuild. */
export const DEFAULT_SONG_URL = `${import.meta.env.BASE_URL}-rack-song.json`

let pending: Promise<boolean> | null = null

/** The newest song in the browser's library, or null when there is none (or no IndexedDB). */
async function lastSavedSong(): Promise<Song | null> {
  try {
    const lib = useLibraryStore.getState()
    await lib.refresh()
    const entry = useLibraryStore.getState().entries[0]
    if (!entry) return null
    lib.setNowPlaying(entry.id)
    return entry.song
  } catch {
    return null
  }
}

async function factorySong(): Promise<Song | null> {
  const res = await fetch(DEFAULT_SONG_URL, { cache: "no-cache" })
  if (!res.ok) return null
  useLibraryStore.getState().setNowPlaying(builtinKey("-rack-song.json"))
  return parseSong(await res.text())
}

/**
 * Load the startup song into the store once: the last one the user saved,
 * else the factory song from `public/`. Resolves to false — leaving the
 * built-in starter groove in place — when neither is available.
 */
export function loadDefaultSong(): Promise<boolean> {
  pending ??= (async () => {
    try {
      const song = (await lastSavedSong()) ?? (await factorySong())
      if (!song) return false
      useRackStore.getState().loadSong(song)
      getEngine().syncFromStore()
      // The rack opens folded; a song the user loads later opens its machines instead.
      const s = useRackStore.getState()
      useRackStore.setState({ folded: foldedAll(s.instances.map((i) => i.id)) })
      return true
    } catch (err) {
      console.warn("rack: startup song not loaded —", err instanceof Error ? err.message : err)
      return false
    }
  })()
  return pending
}

/** Test hook: forget the cached attempt. */
export function resetDefaultSong(): void {
  pending = null
}
