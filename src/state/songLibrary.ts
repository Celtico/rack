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
  /** One level of folders; absent means the top of the list. */
  folder?: string
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
  /** Store a song under a name, in a folder if given; returns the entry. */
  save: (name: string, song: Song, folder?: string | null) => Promise<LibraryEntry>
  /** Replace an entry's song with what the rack holds now; keeps id, name and folder. */
  update: (id: string, song: Song) => Promise<LibraryEntry | null>
  /** Move an entry into a folder (null: out of any). A blank name means no folder. */
  setFolder: (id: string, folder: string | null) => Promise<void>
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

  save: async (name, song, folder = null) => {
    const entry: LibraryEntry = {
      id: newId(),
      name: name.trim() || "Untitled",
      savedAt: Date.now(),
      song,
      ...(folder?.trim() ? { folder: folder.trim() } : {}),
    }
    await put(entry)
    // What was just saved is what the rack holds.
    set((s) => ({ entries: [entry, ...s.entries], nowPlaying: entry.id, unsavedName: null }))
    return entry
  },

  update: async (id, song) => {
    const entry = get().entries.find((e) => e.id === id)
    if (!entry) return null
    const updated: LibraryEntry = { ...entry, song, savedAt: Date.now() }
    await put(updated)
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }))
    return updated
  },

  setFolder: async (id, folder) => {
    const entry = get().entries.find((e) => e.id === id)
    if (!entry) return
    const next = folder?.trim() || undefined
    if (next === entry.folder) return
    const moved: LibraryEntry = { ...entry }
    if (next) moved.folder = next
    else delete moved.folder
    await put(moved)
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? moved : e)) }))
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

/** The folders in use, sorted. */
export const folderNames = (entries: readonly LibraryEntry[]): string[] =>
  [...new Set(entries.flatMap((e) => (e.folder ? [e.folder] : [])))].sort((a, b) =>
    a.localeCompare(b),
  )

/** A file name for a song: its name, made safe. */
export const songFileName = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "song"
  }.json`
