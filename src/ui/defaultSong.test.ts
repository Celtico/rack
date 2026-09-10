import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { useRackStore } from "../state/store"
import { DEFAULT_SONG_URL, loadDefaultSong, resetDefaultSong } from "./defaultSong"
import song from "../../public/-rack-song.json?raw"

const syncFromStore = vi.fn()
vi.mock("../audio/engine", () => ({ getEngine: () => ({ syncFromStore }) }))

describe("loadDefaultSong", () => {
  beforeEach(() => {
    resetDefaultSong()
    syncFromStore.mockClear()
    const instances = defaultInstances()
    useRackStore.setState({ bpm: 120, instances, patterns: createDefaultBank(instances) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("fetches the song from public/ and applies it to the store and engine", async () => {
    const fetchMock = vi.fn(async () => new Response(song, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(loadDefaultSong()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_SONG_URL, expect.anything())
    expect(useRackStore.getState().bpm).toBe(103)
    expect(syncFromStore).toHaveBeenCalledOnce()
    // Everything starts folded, machines of the song included.
    const folded = useRackStore.getState().folded
    expect(folded.TRANSPORT).toBe(true)
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
