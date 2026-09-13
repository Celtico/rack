import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import { defaultInstances } from "./instances"
import { createDefaultBank } from "./patterns"
import { SONG_VERSION, type Song } from "./song"
import { songFileName, useLibraryStore } from "./songLibrary"

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

  it("makes a safe file name from the song's name", () => {
    expect(songFileName("My Techno Jam #2")).toBe("my-techno-jam-2.json")
    expect(songFileName("   ")).toBe("song.json")
  })
})
