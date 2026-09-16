import { serializeSong } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { toSong, useRackStore, type RackState } from "../state/store"

/** Quiet time after the last edit before the song is written. */
export const AUTOSAVE_MS = 1500

/** Did anything a song holds change between two states? Cheap: reference checks. */
export const songChanged = (s: RackState, prev: RackState): boolean =>
  s.patterns !== prev.patterns ||
  s.instances !== prev.instances ||
  s.fx !== prev.fx ||
  s.chain !== prev.chain ||
  s.sections !== prev.sections ||
  s.bpm !== prev.bpm ||
  s.swing !== prev.swing ||
  s.masterVolume !== prev.masterVolume

/** "songs/open-road.json" → "Open road". */
export const humanize = (file: string) => {
  const base = file
    .replace(/^.*\//, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * The name the autosave gives a song that is in no list yet: the file it came
 * from, the demo it grew out of, or a number.
 */
export function autosaveName(
  nowPlaying: string | null,
  unsavedName: string | null,
  count: number,
): string {
  if (unsavedName) return unsavedName
  if (nowPlaying?.startsWith("builtin:")) return `${humanize(nowPlaying.slice(8))} · mine`
  return `Song ${count + 1}`
}

/**
 * Save the song by itself: a moment after any edit, the library entry the rack
 * holds is written over (its previous state kept as a version by the library),
 * and a song that is in no list — a fresh rack with machines in it, an
 * imported file, an edited demo — becomes an entry of its own. Loading a song
 * moves the baseline, so a load is never mistaken for an edit.
 */
export function installAutosave(): () => void {
  let baseline = serializeSong(toSong(useRackStore.getState()))
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    timer = null
    const state = useRackStore.getState()
    const text = serializeSong(toSong(state))
    if (text === baseline) return
    const lib = useLibraryStore.getState()
    if (!lib.loaded) await lib.refresh()
    const key = useLibraryStore.getState().nowPlaying
    const entry = key ? useLibraryStore.getState().entries.find((e) => e.id === key) : undefined
    if (entry) {
      await lib.update(entry.id, toSong(state))
    } else {
      // Nothing to keep of an empty rack.
      if (state.instances.length === 0) return
      const { unsavedName, entries } = useLibraryStore.getState()
      await lib.save(autosaveName(key, unsavedName, entries.length), toSong(state))
    }
    baseline = text
    lib.setAutosavedAt(Date.now())
  }

  const unsubscribeLibrary = useLibraryStore.subscribe((s, prev) => {
    if (s.nowPlaying !== prev.nowPlaying) baseline = serializeSong(toSong(useRackStore.getState()))
  })
  const unsubscribeRack = useRackStore.subscribe((s, prev) => {
    // A load is never an edit: what came in is the new baseline, and a pending write is dropped.
    if (s.loads !== prev.loads) {
      baseline = serializeSong(toSong(s))
      if (timer) clearTimeout(timer)
      timer = null
      return
    }
    if (!songChanged(s, prev)) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), AUTOSAVE_MS)
  })
  return () => {
    if (timer) clearTimeout(timer)
    unsubscribeLibrary()
    unsubscribeRack()
  }
}
