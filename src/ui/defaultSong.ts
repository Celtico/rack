import { getEngine } from "../audio/engine"
import { useLayoutStore } from "../state/layout"
import { BPM_DEFAULT, FX_DEFAULT, MASTER_DEFAULT } from "../state/params"
import { padBank } from "../state/patterns"
import { SONG_VERSION, type Song } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { toSong, useRackStore } from "../state/store"
import { stopTransport } from "./transportControl"

let pending: Promise<boolean> | null = null

/** No machines at all, nothing chained: a rack ready to be built with "Add unit". */
function emptyRack(): Song {
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
    sections: [],
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
    // The rack opens folded (`loadSong` folds every panel).
    return false
  })()
  return pending
}

/** What "New song" replaced, so an Undo can put it back. */
export interface ReplacedRack {
  song: Song
  nowPlaying: string | null
  unsavedName: string | null
}

/**
 * "New song": the rack as it opens the first time — stopped, no machines, no
 * chain, every panel shown and folded, nothing from the library held. Returns
 * what was in the rack, for an Undo.
 */
export function newSong(): ReplacedRack {
  const lib = useLibraryStore.getState()
  const before: ReplacedRack = {
    song: toSong(useRackStore.getState()),
    nowPlaying: lib.nowPlaying,
    unsavedName: lib.unsavedName,
  }
  stopTransport()
  lib.setNowPlaying(null)
  lib.setUnsavedName(null)
  useRackStore.getState().loadSong(emptyRack())
  getEngine().syncFromStore()
  useLayoutStore.getState().showAll()
  return before
}

/** Undo a "New song": the previous song is back in the rack, stopped, with its library link. */
export function restoreRack(before: ReplacedRack): void {
  const lib = useLibraryStore.getState()
  lib.setNowPlaying(before.nowPlaying)
  lib.setUnsavedName(before.unsavedName)
  useRackStore.getState().loadSong(before.song)
  getEngine().syncFromStore()
}

/** Test hook: forget the cached attempt. */
export function resetDefaultSong(): void {
  pending = null
}
