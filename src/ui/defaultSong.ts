import { getEngine } from "../audio/engine"
import { BPM_DEFAULT, FX_DEFAULT, MASTER_DEFAULT } from "../state/params"
import { padBank } from "../state/patterns"
import { SONG_VERSION, type Song } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { foldedAll, useRackStore } from "../state/store"

let pending: Promise<boolean> | null = null

/** No machines at all, nothing chained: a rack ready to be built with "Add unit". */
export function emptyRack(): Song {
  const instances: Song["instances"] = []
  return {
    version: SONG_VERSION,
    bpm: BPM_DEFAULT,
    swing: 0,
    masterVolume: MASTER_DEFAULT,
    instances,
    patterns: padBank([], instances),
    activePattern: 0,
    chain: [],
    fx: { ...FX_DEFAULT },
  }
}

/**
 * Put the startup state in the store once: an empty rack (no machines), stopped and silent,
 * whatever is in the library — songs are picked on purpose from the Songs
 * drawer (the user's own and the demos). Resolves to false: nothing to play.
 */
export function loadDefaultSong(): Promise<boolean> {
  pending ??= (async () => {
    useLibraryStore.getState().setNowPlaying(null)
    useRackStore.getState().loadSong(emptyRack())
    getEngine().syncFromStore()
    // The rack opens folded; a song the user loads later opens its machines instead.
    const s = useRackStore.getState()
    useRackStore.setState({ folded: foldedAll(s.instances.map((i) => i.id)) })
    return false
  })()
  return pending
}

/** Test hook: forget the cached attempt. */
export function resetDefaultSong(): void {
  pending = null
}
