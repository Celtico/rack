import { parseSong, type Song } from "../state/song"

/** One song shipped with the rack, as listed in `public/songs/index.json`. */
export interface BuiltinSong {
  name: string
  /** Path under `public/`, e.g. `songs/kamuffel-style.json`. */
  file: string
  bpm: number
  bars: number
}

const MANIFEST_URL = `${import.meta.env.BASE_URL}songs/index.json`

let list: Promise<BuiltinSong[]> | null = null
const songs = new Map<string, Promise<Song>>()

const isEntry = (v: unknown): v is BuiltinSong =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as BuiltinSong).name === "string" &&
  typeof (v as BuiltinSong).file === "string" &&
  typeof (v as BuiltinSong).bpm === "number" &&
  typeof (v as BuiltinSong).bars === "number"

/**
 * The built-in songs, from a manifest in `public/` so more can be added
 * without a rebuild. Fetched once; a missing or broken manifest lists none.
 */
export function loadBuiltinSongs(): Promise<BuiltinSong[]> {
  list ??= (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" })
      if (!res.ok) return []
      const raw: unknown = await res.json()
      const entries = (raw as { songs?: unknown }).songs
      return Array.isArray(entries) ? entries.filter(isEntry) : []
    } catch (err) {
      console.warn("rack: built-in songs not listed —", err instanceof Error ? err.message : err)
      return []
    }
  })()
  return list
}

/** Fetch and parse one built-in song; parsed once per file. Rejects on a missing or broken file. */
export function loadBuiltinSong(file: string): Promise<Song> {
  let pending = songs.get(file)
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}${file}`, { cache: "no-cache" }).then(
      async (res) => {
        if (!res.ok) throw new Error(`${file}: ${res.status}`)
        return parseSong(await res.text())
      },
    )
    // A failed fetch is not remembered, so the next tap tries again.
    pending.catch(() => songs.delete(file))
    songs.set(file, pending)
  }
  return pending
}

/** Test hook: forget what was fetched. */
export function resetBuiltinSongs(): void {
  list = null
  songs.clear()
}
