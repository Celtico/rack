import { create } from "zustand"

import { getAllFromStore, STORES, withStore } from "./db"
import type { Song } from "./song"

/** One saved song in the browser's library. */
export interface LibraryEntry {
  id: string
  name: string
  /** Epoch ms. */
  savedAt: number
  song: Song
}

const put = (entry: LibraryEntry): Promise<void> =>
  withStore<IDBValidKey>(STORES.songs, "readwrite", (s) => s.put(entry, entry.id)).then(
    () => undefined,
  )

const remove = (id: string): Promise<void> =>
  withStore<undefined>(STORES.songs, "readwrite", (s) => s.delete(id)).then(() => undefined)

const loadAll = async (): Promise<LibraryEntry[]> =>
  Object.values(await getAllFromStore<LibraryEntry>(STORES.songs)).sort(
    (a, b) => b.savedAt - a.savedAt,
  )

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Key of a built-in song in `nowPlaying`, by its file under `public/`. */
export const builtinKey = (file: string) => `builtin:${file}`

export interface LibraryState {
  /** Newest first. Empty until `refresh()` has run. */
  entries: readonly LibraryEntry[]
  loaded: boolean
  /**
   * Which song the rack holds: a saved entry's id, a `builtinKey`, or null
   * after a file import or an edit that is nobody's. UI-only.
   */
  nowPlaying: string | null
  setNowPlaying: (key: string | null) => void
  /** Where an unsaved song came from (a file's name), to suggest a name for it. UI-only. */
  unsavedName: string | null
  setUnsavedName: (name: string | null) => void
  refresh: () => Promise<void>
  /** Store a song under a name; returns the entry. */
  save: (name: string, song: Song) => Promise<LibraryEntry>
  /** Give an entry a new name (blank keeps the old one). */
  rename: (id: string, name: string) => Promise<void>
  /** Drop an entry; returns it so it can be put back. */
  remove: (id: string) => Promise<LibraryEntry | null>
  /** Put a removed entry back, as it was. */
  restore: (entry: LibraryEntry) => Promise<void>
}

/**
 * The song library: songs saved in IndexedDB, mirrored in this store for the
 * UI. Every action writes the database first and then the list, so the list
 * never shows something that was not stored.
 */
export const useLibraryStore = create<LibraryState>()((set, get) => ({
  entries: [],
  loaded: false,
  nowPlaying: null,
  setNowPlaying: (nowPlaying) => set({ nowPlaying }),
  unsavedName: null,
  setUnsavedName: (unsavedName) => set({ unsavedName }),

  refresh: async () => {
    set({ entries: await loadAll(), loaded: true })
  },

  save: async (name, song) => {
    const entry: LibraryEntry = {
      id: newId(),
      name: name.trim() || "Untitled",
      savedAt: Date.now(),
      song,
    }
    await put(entry)
    // What was just saved is what the rack holds.
    set((s) => ({ entries: [entry, ...s.entries], nowPlaying: entry.id, unsavedName: null }))
    return entry
  },

  rename: async (id, name) => {
    const entry = get().entries.find((e) => e.id === id)
    const next = name.trim()
    if (!entry || !next || next === entry.name) return
    const renamed = { ...entry, name: next }
    await put(renamed)
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? renamed : e)) }))
  },

  remove: async (id) => {
    const entry = get().entries.find((e) => e.id === id) ?? null
    if (!entry) return null
    await remove(id)
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    return entry
  },

  restore: async (entry) => {
    await put(entry)
    set((s) => ({
      entries: [...s.entries.filter((e) => e.id !== entry.id), entry].sort(
        (a, b) => b.savedAt - a.savedAt,
      ),
    }))
  },
}))

/** A file name for a song: its name, made safe. */
export const songFileName = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "song"
  }.json`
