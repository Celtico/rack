import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { parseSong } from "../state/song"
import { useLibraryStore } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { DEFAULT_SONG_URL, loadDefaultSong, resetDefaultSong } from "./defaultSong"
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

  it("prefers the last song saved in the library over the factory one", async () => {
    const saved = parseSong(song)
    await useLibraryStore.getState().save("Mine", { ...saved, bpm: 99 })
    useLibraryStore.setState({ entries: [], loaded: false })
    const fetchMock = vi.fn(async () => new Response(song, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadDefaultSong()).resolves.toBe(true)
    expect(useRackStore.getState().bpm).toBe(99)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(syncFromStore).toHaveBeenCalledOnce()
  })

  it("fetches the song from public/ and applies it to the store and engine", async () => {
    const fetchMock = vi.fn(async () => new Response(song, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadDefaultSong()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_SONG_URL, expect.anything())
    // The factory techno song runs at 128.
    expect(useRackStore.getState().bpm).toBe(128)
    expect(syncFromStore).toHaveBeenCalledOnce()
    // Everything starts folded, machines of the song included.
    const folded = useRackStore.getState().folded
    expect(folded["FX-2"]).toBe(true)
    expect(folded.SONG).toBe(true)
    for (const inst of useRackStore.getState().instances) expect(folded[inst.id]).toBe(true)
  })

  it("keeps the built-in starter when the file is missing or broken, and only tries once", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    )
    await expect(loadDefaultSong()).resolves.toBe(false)
    expect(useRackStore.getState().bpm).toBe(120)

    resetDefaultSong()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(loadDefaultSong()).resolves.toBe(false)
    await loadDefaultSong()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalled()
    expect(syncFromStore).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
