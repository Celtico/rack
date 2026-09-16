import { useLibraryStore } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { humanize } from "./autosave"

/** Shown for a rack with nothing in it. */
export const NO_SONG = "—"

/**
 * The name of the song the rack holds, as the transport prints it: the saved
 * entry's, the demo's (from its file name), the file's it was loaded from, or
 * "Untitled" for a song that is nobody's yet. Pure.
 */
export function songTitle(input: {
  nowPlaying: string | null
  entryName: string | undefined
  unsavedName: string | null
  empty: boolean
}): string {
  const { nowPlaying, entryName, unsavedName, empty } = input
  if (entryName) return entryName
  if (nowPlaying?.startsWith("builtin:")) return humanize(nowPlaying.slice(8))
  if (unsavedName) return unsavedName
  return empty ? NO_SONG : "Untitled"
}

export function useSongTitle(): string {
  const nowPlaying = useLibraryStore((s) => s.nowPlaying)
  const unsavedName = useLibraryStore((s) => s.unsavedName)
  const entryName = useLibraryStore((s) =>
    nowPlaying ? s.entries.find((e) => e.id === nowPlaying)?.name : undefined,
  )
  const empty = useRackStore((s) => s.instances.length === 0)
  return songTitle({ nowPlaying, entryName, unsavedName, empty })
}
