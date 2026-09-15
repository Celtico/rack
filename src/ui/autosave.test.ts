import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defaultInstances } from "../state/instances"
import { createDefaultBank } from "../state/patterns"
import { useLibraryStore } from "../state/songLibrary"
import { toSong, useRackStore } from "../state/store"
import { AUTOSAVE_MS, autosaveName, installAutosave } from "./autosave"

/** Let the debounce fire (fake timeout) and the database writes settle (real event loop turns). */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10)
  const next = (globalThis as unknown as { setImmediate: (cb: () => void) => void }).setImmediate
  for (let i = 0; i < 40; i++) await new Promise<void>((r) => next(r))
}

describe("autosaveName", () => {
  it("prefers the file's name, then the demo's, then a number", () => {
    expect(autosaveName(null, "loop.mid", 3)).toBe("loop.mid")
    expect(autosaveName("builtin:songs/open-road.json", null, 3)).toBe("Open road · mine")
    expect(autosaveName(null, null, 3)).toBe("Song 4")
  })
})

describe("installAutosave", () => {
  let stop: () => void = () => {}

  beforeEach(async () => {
    // Only the debounce and the clock: fake-indexeddb needs the real event loop.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    const instances = defaultInstances()
    useRackStore.setState({
      bpm: 120,
      instances,
      patterns: createDefaultBank(instances),
      chain: [],
      activePattern: 0,
    })
    const lib = useLibraryStore.getState()
    await lib.refresh()
    for (const e of lib.entries) await lib.remove(e.id)
    useLibraryStore.setState({
      entries: [],
      loaded: true,
      nowPlaying: null,
      unsavedName: null,
      autosavedAt: null,
      versions: {},
    })
  })
  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it("turns an unsaved rack into a library entry a moment after an edit, then keeps it updated", async () => {
    stop = installAutosave()
    useRackStore.getState().setBpm(121)
    useRackStore.getState().setBpm(122)
    expect(useLibraryStore.getState().entries).toHaveLength(0)
    await settle()
    const lib = useLibraryStore.getState()
    expect(lib.entries).toHaveLength(1)
    expect(lib.entries[0]!.name).toBe("Song 1")
    expect(lib.entries[0]!.song.bpm).toBe(122)
    expect(lib.nowPlaying).toBe(lib.entries[0]!.id)
    expect(lib.autosavedAt).not.toBeNull()

    useRackStore.getState().toggleStep("drums-1", "kick", 3)
    await settle()
    const again = useLibraryStore.getState()
    expect(again.entries).toHaveLength(1)
    expect(again.entries[0]!.song.patterns[0]!.tracks["drums-1"]).toMatchObject({ kind: "drums" })
    expect(again.versions[again.entries[0]!.id]).toHaveLength(1)
  })

  it("does not mistake a load for an edit, and leaves an empty rack alone", async () => {
    stop = installAutosave()
    const song = { ...toSong(useRackStore.getState()), bpm: 99 }
    // Whichever comes first, the load or the key: a load is not an edit.
    useLibraryStore.getState().setNowPlaying("builtin:songs/demo.json")
    useRackStore.getState().loadSong(song)
    await settle()
    expect(useLibraryStore.getState().entries).toHaveLength(0)
    // An edit of the demo becomes the user's own copy.
    useRackStore.getState().setBpm(101)
    await settle()
    expect(useLibraryStore.getState().entries.map((e) => e.name)).toEqual(["Demo · mine"])
    useLibraryStore.setState({ entries: [], loaded: true, nowPlaying: null })

    useRackStore.getState().loadSong({ ...song, instances: [], patterns: [{ tracks: {} }] })
    useLibraryStore.getState().setNowPlaying(null)
    useRackStore.getState().setBpm(100)
    await settle()
    expect(useLibraryStore.getState().entries).toHaveLength(0)
  })
})
