import { beforeEach, describe, expect, it } from "vitest"

import { createDefaultBank } from "./patterns"
import { parseSong, serializeSong, SongParseError } from "./song"
import { toSong, useRackStore } from "./store"

describe("song save/load", () => {
  beforeEach(() => {
    useRackStore.setState({
      bpm: 120,
      masterVolume: 0.8,
      patterns: createDefaultBank(),
      activePattern: 0,
      chain: [],
    })
  })

  it("round-trips the whole state through JSON", () => {
    const store = useRackStore.getState()
    store.setBpm(97)
    store.setActivePattern(1)
    store.toggleDrumStep("clap", 5)
    store.toggleSynthNote(2, 6)
    store.appendToChain(0)
    store.appendToChain(1)
    store.setSynthParam("waveform", "square")
    store.setFxParam("delayTime", "4n")
    store.setChannelSend("synth", 0.6)

    const text = serializeSong(toSong(useRackStore.getState()))
    const song = parseSong(text)

    expect(song).toEqual(toSong(useRackStore.getState()))
    expect(song.patterns[1]!.drums.clap[5]).toBe(true)
    expect(song.patterns[1]!.synth[2]).toBe(6)
    expect(song.chain).toEqual([0, 1])
  })

  it("applies a loaded song and clamps out-of-range numbers", () => {
    const base = toSong(useRackStore.getState())
    const song = {
      ...base,
      bpm: 999,
      mix: { ...base.mix, send: { ...base.mix.send, drums: 3 } },
      synthParams: { ...base.synthParams, cutoff: 1 },
      chain: [3, 2],
    }

    useRackStore.getState().loadSong(song)
    const s = useRackStore.getState()
    expect(s.bpm).toBe(240)
    expect(s.mix.send.drums).toBe(1)
    expect(s.synthParams.cutoff).toBe(80)
    expect(s.chain).toEqual([3, 2])
  })

  it("keeps swing through a round-trip and defaults it for files that predate it", () => {
    useRackStore.getState().setSwing(0.6)
    const song = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(song.swing).toBe(0.6)

    const legacy = JSON.parse(serializeSong(song)) as Record<string, unknown>
    delete legacy.swing
    expect(parseSong(JSON.stringify(legacy)).swing).toBe(0)
  })

  it("loads a song saved before PERC-6 existed with empty perc rows and default levels", () => {
    const legacy = JSON.parse(serializeSong(toSong(useRackStore.getState()))) as {
      patterns: Record<string, unknown>[]
      percLevels?: unknown
      mix: { level: Record<string, number>; send: Record<string, number> }
    }
    for (const p of legacy.patterns) {
      delete p.perc
      delete p.bass
      delete p.poly
    }
    delete legacy.percLevels
    delete (legacy as Record<string, unknown>).bassParams
    delete (legacy as Record<string, unknown>).polyParams
    delete (legacy as Record<string, unknown>).epParams
    delete (legacy as Record<string, unknown>).stringsParams
    delete legacy.mix.level.perc
    delete legacy.mix.send.perc
    delete legacy.mix.level.bass
    delete legacy.mix.send.bass

    const song = parseSong(JSON.stringify(legacy))
    expect(song.patterns[0]!.perc.shaker.some(Boolean)).toBe(false)
    expect(song.patterns[0]!.bass.notes.every((n) => n === null)).toBe(true)
    expect(song.percLevels.crash).toBe(0.5)
    expect(song.bassParams.waveform).toBe("sawtooth")
    expect(song.patterns[0]!.poly.ep.every((c) => c.length === 0)).toBe(true)
    expect(song.polyParams.cutoff).toBe(2200)
    expect(song.epParams.tone).toBe(2)
    expect(song.stringsParams.damp).toBe(3200)
    expect(song.mix.level.perc).toBe(0.8)
    expect(song.mix.send.perc).toBe(0.25)
    expect(song.mix.level.bass).toBe(0.85)
  })

  it("rejects files that are not a song", () => {
    expect(() => parseSong("not json")).toThrow(SongParseError)
    expect(() => parseSong("{}")).toThrow(/song\.version/)

    const song = toSong(useRackStore.getState())
    const broken = JSON.parse(serializeSong(song)) as Record<string, unknown>
    ;(broken.patterns as unknown[])[0] = { drums: {}, synth: [] }
    expect(() => parseSong(JSON.stringify(broken))).toThrow(/patterns\[0\]\.drums\.kick/)

    const badNote = JSON.parse(serializeSong(song)) as { patterns: { synth: unknown[] }[] }
    badNote.patterns[0]!.synth[3] = 8
    expect(() => parseSong(JSON.stringify(badNote))).toThrow(/synth\[3\]/)

    const badWave = JSON.parse(serializeSong(song)) as { synthParams: { waveform: string } }
    badWave.synthParams.waveform = "noise"
    expect(() => parseSong(JSON.stringify(badWave))).toThrow(/waveform/)
  })
})
