import { describe, expect, it } from "vitest"

import { NO_SONG, songTitle } from "./songTitle"

describe("songTitle", () => {
  it("names the song the rack holds: entry, demo file, loaded file, or nothing", () => {
    const base = { nowPlaying: null, entryName: undefined, unsavedName: null, empty: false }
    expect(songTitle({ ...base, nowPlaying: "abc", entryName: "Alanaladejo" })).toBe("Alanaladejo")
    expect(songTitle({ ...base, nowPlaying: "builtin:songs/open-road.json" })).toBe("Open road")
    expect(songTitle({ ...base, unsavedName: "groove.mid" })).toBe("groove.mid")
    expect(songTitle(base)).toBe("Untitled")
    expect(songTitle({ ...base, empty: true })).toBe(NO_SONG)
  })
})
