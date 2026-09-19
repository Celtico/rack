import { create } from "zustand"

import { getEngine } from "../audio/engine"
import { useLibraryStore, type LibraryEntry } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { startTransport, stopTransport } from "./transportControl"

/** A song with a short chain (or none) still gets this many bars before the next one. */
const MIN_BARS = 8

interface PlaylistState {
  /** The folder being played through, or null. */
  folder: string | null
}

/** Which folder the rack is playing through, for the library to show. */
export const usePlaylistStore = create<PlaylistState>(() => ({ folder: null }))

let active: { folder: string; entries: LibraryEntry[]; index: number; stop: () => void } | null =
  null

/** Bars a song plays before the playlist moves on: its whole chain, at least `MIN_BARS`. */
function barsFor(chainLength: number): number {
  return Math.max(chainLength, MIN_BARS)
}

/**
 * Play every song of a folder in turn, round and round: each one from the top,
 * for its whole chain (a short or empty chain still gets `MIN_BARS`), then the
 * next. Stopping the clock, or playing anything else, ends the run.
 */
export async function playFolder(folder: string, entries: LibraryEntry[]): Promise<void> {
  stopPlaylist()
  if (entries.length === 0) return
  let stopped = false
  // Set while a song is being swapped in: the clock stops and restarts, which is not the user stopping.
  let switching = false
  const stop = () => {
    stopped = true
    unsubscribe()
  }
  const run = { folder, entries, index: 0, stop }
  active = run
  usePlaylistStore.setState({ folder })

  // The bar counter restarts with every song, so the switch is simply "bar N has begun".
  const unsubscribe = useRackStore.subscribe((s, prev) => {
    if (stopped || switching) return
    const entry = run.entries[run.index]
    if (prev.playing && !s.playing) return stopPlaylist()
    if (!entry || useLibraryStore.getState().nowPlaying !== entry.id) return stopPlaylist()
    if (s.playingBar === prev.playingBar || s.playingBar < barsFor(s.chain.length)) return
    void play((run.index + 1) % run.entries.length)
  })

  const play = async (index: number) => {
    const entry = run.entries[index]
    if (!entry || stopped) return
    switching = true
    run.index = index
    const engine = getEngine()
    void engine.resumeAudio()
    stopTransport()
    const { loadSong, setFollowSong } = useRackStore.getState()
    loadSong(entry.song)
    setFollowSong(true)
    useLibraryStore.getState().setNowPlaying(entry.id)
    engine.syncFromStore()
    try {
      await startTransport()
    } finally {
      switching = false
    }
  }

  await play(0)
}

/** Forget the folder; the song playing carries on by itself. */
export function stopPlaylist(): void {
  active?.stop()
  active = null
  if (usePlaylistStore.getState().folder !== null) usePlaylistStore.setState({ folder: null })
}
