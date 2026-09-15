import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultInstances } from "../state/instances"
import { isPatternEmpty } from "../state/pattern"
import { createDefaultBank } from "../state/patterns"
import { parseSong } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { loadDefaultSong, newSong, resetDefaultSong, restoreRack } from "./defaultSong"
import song from "../../public/-rack-song.json?raw"
import { useLayoutStore } from "../state/layout"

const syncFromStore = vi.fn()
const stop = vi.fn()
vi.mock("../audio/engine", () => ({ getEngine: () => ({ syncFromStore, stop }) }))

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

  it("newSong stops, empties and shows the whole rack, and restoreRack brings the song back", () => {
    const saved = parseSong(song)
    useRackStore.getState().loadSong(saved)
    useRackStore.setState({ playing: true, currentStep: 5, solo: { "drums-1": true } })
    useLibraryStore.getState().setNowPlaying("entry-1")
    useLayoutStore.getState().hideUnit("FX-2")

    const before = newSong()
    const s = useRackStore.getState()
    expect(stop).toHaveBeenCalledOnce()
    expect(s.playing).toBe(false)
    expect(s.currentStep).toBe(-1)
    expect(s.instances).toEqual([])
    expect(s.chain).toEqual([])
    expect(s.patterns.every(isPatternEmpty)).toBe(true)
    expect(s.solo).toEqual({})
    expect(s.folded).toMatchObject({ PATTERN: true, SONG: true, "FX-2": true })
    expect(s.folded.CLOCK).toBeUndefined()
    expect(useLayoutStore.getState().hidden).toEqual([])
    expect(useLibraryStore.getState().nowPlaying).toBeNull()
    expect(before.nowPlaying).toBe("entry-1")
    expect(before.song.instances.map((i) => i.id)).toEqual(saved.instances.map((i) => i.id))

    restoreRack(before)
    expect(useRackStore.getState().instances.map((i) => i.id)).toEqual(
      saved.instances.map((i) => i.id),
    )
    expect(useRackStore.getState().chain).toEqual(saved.chain)
    expect(useLibraryStore.getState().nowPlaying).toBe("entry-1")
  })
})
