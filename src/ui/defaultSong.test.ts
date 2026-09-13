import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultInstances } from "../state/instances"
import { isPatternEmpty } from "../state/pattern"
import { createDefaultBank } from "../state/patterns"
import { parseSong } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { loadDefaultSong, resetDefaultSong } from "./defaultSong"
import song from "../../public/-rack-song.json?raw"

const syncFromStore = vi.fn()
vi.mock("../audio/engine", () => ({ getEngine: () => ({ syncFromStore }) }))

describe("loadDefaultSong", () => {
  beforeEach(async () => {
    resetDefaultSong()
    syncFromStore.mockClear()
    const instances = defaultInstances()
    useRackStore.setState({ bpm: 120, instances, patterns: createDefaultBank(instances) })
    // An empty library, so the factory song is what loads unless a test saves one.
    const lib = useLibraryStore.getState()
    await lib.refresh()
    for (const e of lib.entries) await lib.remove(e.id)
    useLibraryStore.setState({ entries: [], loaded: false })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("does not pick up a saved song either: the library is for choosing on purpose", async () => {
    const saved = parseSong(song)
    await useLibraryStore.getState().save("Mine", { ...saved, bpm: 99 })
    useLibraryStore.setState({ entries: [], loaded: false })

    await expect(loadDefaultSong()).resolves.toBe(false)
    expect(useRackStore.getState().bpm).toBe(120)
    expect(useRackStore.getState().patterns.every(isPatternEmpty)).toBe(true)
    expect(useLibraryStore.getState().nowPlaying).toBeNull()
  })

  it("starts with an empty, stopped rack when nothing is saved, and only does the work once", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadDefaultSong()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    const s = useRackStore.getState()
    expect(s.bpm).toBe(120)
    expect(s.chain).toEqual([])
    expect(s.patterns.every(isPatternEmpty)).toBe(true)
    expect(s.instances).toEqual([])
    expect(syncFromStore).toHaveBeenCalledOnce()
    expect(useLibraryStore.getState().nowPlaying).toBeNull()
    // Everything starts folded.
    expect(s.folded["FX-2"]).toBe(true)

    await loadDefaultSong()
    expect(syncFromStore).toHaveBeenCalledOnce()
  })
})
