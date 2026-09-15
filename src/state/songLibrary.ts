import { create } from "zustand"

import { getAllFromStore, STORES, withStore } from "./db"
import { serializeSong, type Song } from "./song"

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

/** An earlier state of a saved song, kept when the song was next written over. */
export interface SongVersion {
  id: string
  entryId: string
  /** When this state was last the current one — the moment it was replaced. */
  savedAt: number
  song: Song
}

/** Versions closer together than this collapse: the newest one stands for the burst. */
export const VERSION_GAP_MS = 2 * 60 * 1000
/** Versions kept per song; the oldest go. */
export const MAX_VERSIONS = 30

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

const putVersion = (v: SongVersion): Promise<void> =>
  withStore<IDBValidKey>(STORES.versions, "readwrite", (s) => s.put(v, v.id)).then(() => undefined)

const removeVersionRecord = (id: string): Promise<void> =>
  withStore<undefined>(STORES.versions, "readwrite", (s) => s.delete(id)).then(() => undefined)

/** Every version of every song, newest first. */
const loadAllVersions = async (): Promise<SongVersion[]> =>
  Object.values(await getAllFromStore<SongVersion>(STORES.versions)).sort(
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
  /** When the autosave last wrote, for the panel to say so. UI-only. */
  autosavedAt: number | null
  setAutosavedAt: (at: number | null) => void
  /** Earlier states per entry id, newest first — once `loadVersions` has run for it. */
  versions: Readonly<Record<string, readonly SongVersion[]>>
  refresh: () => Promise<void>
  /** Store a song under a name, in a folder if given; returns the entry. */
  save: (name: string, song: Song, folder?: string | null) => Promise<LibraryEntry>
  /**
   * Replace an entry's song with what the rack holds now; keeps id, name and
   * folder. The state it replaces becomes a version — unless one was kept
   * within `VERSION_GAP_MS` (`keep` forces it). An identical song writes nothing.
   */
  update: (id: string, song: Song, keep?: boolean) => Promise<LibraryEntry | null>
  /** Move an entry into a folder (null: out of any). A blank name means no folder. */
  setFolder: (id: string, folder: string | null) => Promise<void>
  /** Give an entry a new name (blank keeps the old one). */
  rename: (id: string, name: string) => Promise<void>
  /** Drop an entry and its versions; returns it so it can be put back. */
  remove: (id: string) => Promise<LibraryEntry | null>
  /** Put a removed entry back, as it was. */
  restore: (entry: LibraryEntry) => Promise<void>
  /** Read an entry's versions from the database into `versions`. */
  loadVersions: (id: string) => Promise<readonly SongVersion[]>
  /** Keep an entry's current song as a version now, whatever the gap — before it is replaced on purpose. */
  keepVersion: (id: string) => Promise<void>
  removeVersion: (versionId: string) => Promise<void>
}

/**
 * The song library: songs saved in IndexedDB, mirrored in this store for the
 * UI. Every action writes the database first and then the list, so the list
 * never shows something that was not stored.
 */
export const useLibraryStore = create<LibraryState>()((set, get) => {
  /** Add a version for an entry, dropping the oldest past the cap. */
  const pushVersion = async (entryId: string, song: Song, at: number) => {
    const have = get().versions[entryId] ?? (await get().loadVersions(entryId))
    // Newest first is by time; two in the same millisecond would come back in any order.
    const savedAt = have[0] && at <= have[0].savedAt ? have[0].savedAt + 1 : at
    const version: SongVersion = { id: newId(), entryId, savedAt, song }
    await putVersion(version)
    const next = [version, ...have].sort((a, b) => b.savedAt - a.savedAt)
    const kept = next.slice(0, MAX_VERSIONS)
    for (const old of next.slice(MAX_VERSIONS)) await removeVersionRecord(old.id)
    set((s) => ({ versions: { ...s.versions, [entryId]: kept } }))
  }

  return {
    entries: [],
    loaded: false,
    nowPlaying: null,
    setNowPlaying: (nowPlaying) => set({ nowPlaying }),
    unsavedName: null,
    setUnsavedName: (unsavedName) => set({ unsavedName }),
    autosavedAt: null,
    setAutosavedAt: (autosavedAt) => set({ autosavedAt }),
    versions: {},

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

    update: async (id, song, keep = false) => {
      const entry = get().entries.find((e) => e.id === id)
      if (!entry) return null
      if (serializeSong(entry.song) === serializeSong(song)) return entry
      const now = Date.now()
      const last = (get().versions[id] ?? (await get().loadVersions(id)))[0]
      if (keep || !last || now - last.savedAt > VERSION_GAP_MS) {
        await pushVersion(id, entry.song, now)
      }
      const updated: LibraryEntry = { ...entry, song, savedAt: now }
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
      for (const v of await get().loadVersions(id)) await removeVersionRecord(v.id)
      set((s) => {
        const { [id]: _gone, ...versions } = s.versions
        return { entries: s.entries.filter((e) => e.id !== id), versions }
      })
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

    loadVersions: async (id) => {
      const mine = (await loadAllVersions()).filter((v) => v.entryId === id)
      set((s) => ({ versions: { ...s.versions, [id]: mine } }))
      return mine
    },

    keepVersion: async (id) => {
      const entry = get().entries.find((e) => e.id === id)
      if (!entry) return
      const last = (get().versions[id] ?? (await get().loadVersions(id)))[0]
      // Already kept as it is: nothing to add.
      if (last && serializeSong(last.song) === serializeSong(entry.song)) return
      await pushVersion(id, entry.song, Date.now())
    },

    removeVersion: async (versionId) => {
      await removeVersionRecord(versionId)
      set((s) => ({
        versions: Object.fromEntries(
          Object.entries(s.versions).map(([k, list]) => [
            k,
            list.filter((v) => v.id !== versionId),
          ]),
        ),
      }))
    },
  }
})

/** The folders in use, sorted. */
export const folderNames = (entries: readonly LibraryEntry[]): string[] =>
  [...new Set(entries.flatMap((e) => (e.folder ? [e.folder] : [])))].sort((a, b) =>
    a.localeCompare(b),
  )

/** A file name for a song: its name, made safe. */
export const songFileName = (name: string, extension = "json") =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "song"
  }.${extension}`
