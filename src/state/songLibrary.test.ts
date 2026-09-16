import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { defaultInstances } from "./instances"
import { createDefaultBank } from "./patterns"
import { SONG_VERSION, type Song } from "./song"
import {
  folderNames,
  MAX_VERSIONS,
  songFileName,
  useLibraryStore,
  VERSION_GAP_MS,
} from "./songLibrary"

const song = (bpm: number): Song => {
  const instances = defaultInstances()
  return {
    version: SONG_VERSION,
    bpm,
    swing: 0,
    masterVolume: 0.8,
    instances,
    patterns: createDefaultBank(instances),
    activePattern: 0,
    chain: [],
    sections: [],
    fx: { delayTime: "8n", feedback: 0.3, reverbDecay: 2 },
  }
}

describe("song library", () => {
  beforeEach(async () => {
    const s = useLibraryStore.getState()
    await s.refresh()
    for (const e of s.entries) await s.remove(e.id)
    useLibraryStore.setState({ entries: [], loaded: false })
  })

  it("saves, lists newest first, survives a refresh, and removes", async () => {
    const s = useLibraryStore.getState()
    const a = await s.save("First", song(120))
    await new Promise((r) => setTimeout(r, 2))
    const b = await s.save("  ", song(128))
    expect(b.name).toBe("Untitled")
    expect(useLibraryStore.getState().entries.map((e) => e.id)).toEqual([b.id, a.id])

    // What the list shows is what the database holds.
    useLibraryStore.setState({ entries: [], loaded: false })
    await s.refresh()
    const listed = useLibraryStore.getState().entries
    expect(listed.map((e) => e.name)).toEqual(["Untitled", "First"])
    expect(listed[1]?.song.bpm).toBe(120)

    const removed = await s.remove(a.id)
    expect(removed?.id).toBe(a.id)
    expect(useLibraryStore.getState().entries).toHaveLength(1)
    expect(await s.remove("nope")).toBeNull()

    await s.restore(removed!)
    expect(useLibraryStore.getState().entries.map((e) => e.id)).toEqual([b.id, a.id])

    // Renaming keeps the id and the song, and survives a refresh; blank names are ignored.
    await s.rename(a.id, "  Renamed  ")
    await s.rename(b.id, "   ")
    useLibraryStore.setState({ entries: [], loaded: false })
    await s.refresh()
    const again = useLibraryStore.getState().entries
    expect(again.find((e) => e.id === a.id)?.name).toBe("Renamed")
    expect(again.find((e) => e.id === a.id)?.song.bpm).toBe(120)
    expect(again.find((e) => e.id === b.id)?.name).toBe("Untitled")
  })

  it("updates a saved song in place, keeping its id, name and folder", async () => {
    const s = useLibraryStore.getState()
    const a = await s.save("Keep me", song(120), "Sets")
    const updated = await s.update(a.id, song(140))
    expect(updated?.id).toBe(a.id)
    expect(updated?.name).toBe("Keep me")
    expect(updated?.folder).toBe("Sets")
    useLibraryStore.setState({ entries: [], loaded: false })
    await s.refresh()
    expect(useLibraryStore.getState().entries.find((e) => e.id === a.id)?.song.bpm).toBe(140)
    expect(await s.update("nope", song(100))).toBeNull()
  })

  it("keeps the replaced song as a version, spaced by the gap, capped, and gone with the entry", async () => {
    // Only the clock: fake-indexeddb delivers its results through real timers.
    vi.useFakeTimers({ now: 1_000_000, toFake: ["Date"] })
    try {
      const s = useLibraryStore.getState()
      const a = await s.save("Versioned", song(120))
      expect(await s.loadVersions(a.id)).toEqual([])

      // The first change keeps the original; an identical write changes nothing.
      await s.update(a.id, song(121))
      await s.update(a.id, song(121))
      let versions = useLibraryStore.getState().versions[a.id]!
      expect(versions.map((v) => v.song.bpm)).toEqual([120])

      // Within the gap the version list stays; the entry moves on.
      vi.setSystemTime(1_000_000 + VERSION_GAP_MS / 2)
      await s.update(a.id, song(122))
      expect(useLibraryStore.getState().versions[a.id]!.map((v) => v.song.bpm)).toEqual([120])
      expect(useLibraryStore.getState().entries[0]!.song.bpm).toBe(122)
      // `keep` forces one; so does waiting past the gap.
      await s.update(a.id, song(123), true)
      vi.setSystemTime(1_000_000 + VERSION_GAP_MS * 2)
      await s.update(a.id, song(124))
      versions = useLibraryStore.getState().versions[a.id]!
      expect(versions.map((v) => v.song.bpm)).toEqual([123, 122, 120])
      // keepVersion adds the current state once, not twice.
      await s.keepVersion(a.id)
      await s.keepVersion(a.id)
      expect(useLibraryStore.getState().versions[a.id]!.map((v) => v.song.bpm)).toEqual([
        124, 123, 122, 120,
      ])

      // Survives a reload of the store.
      useLibraryStore.setState({ entries: [], loaded: false, versions: {} })
      await s.refresh()
      expect((await s.loadVersions(a.id)).map((v) => v.song.bpm)).toEqual([124, 123, 122, 120])

      // Capped at MAX_VERSIONS, oldest first out.
      for (let i = 0; i < MAX_VERSIONS + 3; i++) {
        vi.setSystemTime(2_000_000 + i * VERSION_GAP_MS * 2)
        await s.update(a.id, song(200 + i))
      }
      const capped = useLibraryStore.getState().versions[a.id]!
      expect(capped).toHaveLength(MAX_VERSIONS)
      expect(capped[0]!.song.bpm).toBe(200 + MAX_VERSIONS + 1)

      const [first] = capped
      await s.removeVersion(first!.id)
      expect(useLibraryStore.getState().versions[a.id]).toHaveLength(MAX_VERSIONS - 1)

      await s.remove(a.id)
      expect(await s.loadVersions(a.id)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it("puts songs in folders, moves them, and lists the folders in use", async () => {
    const s = useLibraryStore.getState()
    const a = await s.save("In techno", song(130), "Techno")
    const b = await s.save("Loose", song(90))
    expect(a.folder).toBe("Techno")
    expect(b.folder).toBeUndefined()
    expect(folderNames(useLibraryStore.getState().entries)).toEqual(["Techno"])
    await s.setFolder(b.id, "  Ballads ")
    await s.setFolder(a.id, null)
    useLibraryStore.setState({ entries: [], loaded: false })
    await s.refresh()
    const again = useLibraryStore.getState().entries
    expect(again.find((e) => e.id === b.id)?.folder).toBe("Ballads")
    expect(again.find((e) => e.id === a.id)?.folder).toBeUndefined()
    expect(folderNames(again)).toEqual(["Ballads"])
  })

  it("makes a safe file name from the song's name", () => {
    expect(songFileName("My Techno Jam #2")).toBe("my-techno-jam-2.json")
    expect(songFileName("   ")).toBe("song.json")
  })
})
