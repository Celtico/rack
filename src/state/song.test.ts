import { beforeEach, describe, expect, it } from "vitest"

import { defaultInstances, type Instance, type InstanceOf } from "./instances"
import { isPatternEmpty, rowsOf, type Kind, type KitTrack, type PolyTrack } from "./pattern"
import { createDefaultBank, PATTERN_COUNT } from "./patterns"
import { parseSong, serializeSong, SongParseError, type Song } from "./song"
import { FX_DEFAULT, STRINGS_PARAMS_DEFAULT, toSong, useRackStore } from "./store"
import rackSongText from "../../docs/rack-song.json?raw"

/** Every song file shipped in docs/, as text. */
const SAMPLE_SONGS = import.meta.glob<string>("../../docs/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
})

/** The songs shipped in the app, as text. */
const BUILTIN_SONGS = import.meta.glob<string>("../../public/songs/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
})

const kitOf = (song: Song, slot: number, id: string) =>
  rowsOf(song.patterns[slot]!.tracks[id] as KitTrack)
const instOf = <K extends Kind>(song: Song, id: string) =>
  song.instances.find((i) => i.id === id) as InstanceOf<K>

describe("song save/load", () => {
  beforeEach(() => {
    const instances = defaultInstances()
    useRackStore.setState({
      bpm: 120,
      swing: 0,
      masterVolume: 0.8,
      patterns: createDefaultBank(instances),
      activePattern: 0,
      chain: [],
      instances,
    })
  })

  it("round-trips the whole state through JSON, extra instances included", () => {
    const store = useRackStore.getState()
    store.setBpm(97)
    store.setActivePattern(1)
    store.toggleStep("drums-1", "clap", 5)
    store.toggleNote("synth-1", 2, 6)
    store.appendToChain(0)
    store.appendToChain(1)
    store.setInstanceParams("synth-1", { waveform: "square" })
    store.setInstanceParams("strings-1", { sound: "electric" })
    store.setFxParam("delayTime", "4n")
    store.setInstanceSend("synth-1", 0.6)
    store.setInstanceMute("perc-1", true)
    const second = store.addInstance("drums")
    useRackStore.getState().toggleStep(second.id, "kick", 9)

    const text = serializeSong(toSong(useRackStore.getState()))
    const song = parseSong(text)

    expect(song).toEqual(toSong(useRackStore.getState()))
    expect(song.version).toBe(2)
    expect(kitOf(song, 1, "drums-1").clap![5]).toBe(true)
    expect(kitOf(song, 1, "drums-2").kick![9]).toBe(true)
    const synth = song.patterns[1]!.tracks["synth-1"]!
    expect(synth.kind === "synth" && synth.notes[2]).toBe(6)
    expect(instOf<"synth">(song, "synth-1").params.waveform).toBe("square")
    expect(instOf<"strings">(song, "strings-1").params.sound).toBe("electric")
    expect(instOf<"perc">(song, "perc-1").mute).toBe(true)
    expect(song.chain).toEqual([0, 1])
  })

  it("keeps sections through a round-trip, fits loose ones to the chain and defaults to none", () => {
    const store = useRackStore.getState()
    store.applyStructure([
      { name: "Intro", bars: 2 },
      { name: "Verse", bars: 4 },
    ])
    const text = serializeSong(toSong(useRackStore.getState()))
    expect(parseSong(text).sections).toEqual([
      { name: "Intro", bars: 2 },
      { name: "Verse", bars: 4 },
    ])

    const loose = JSON.parse(text) as Record<string, unknown>
    loose.sections = [{ name: "Intro", bars: 2 }, { bars: 40 }]
    expect(parseSong(JSON.stringify(loose)).sections).toEqual([
      { name: "Intro", bars: 2 },
      { name: "", bars: 4 },
    ])
    delete loose.sections
    expect(parseSong(JSON.stringify(loose)).sections).toEqual([])

    // A song object saved in the library before sections existed loads too.
    const { sections: _gone, ...stored } = toSong(useRackStore.getState())
    useRackStore.getState().loadSong(stored as Song)
    expect(useRackStore.getState().sections).toEqual([])
    expect(useRackStore.getState().chain).toHaveLength(6)
  })

  it("applies a loaded song and clamps out-of-range numbers", () => {
    const base = toSong(useRackStore.getState())
    const song: Song = {
      ...base,
      bpm: 999,
      instances: base.instances.map((i) =>
        i.id === "drums-1"
          ? { ...i, send: 3 }
          : i.id === "synth-1"
            ? ({ ...i, params: { ...i.params, cutoff: 1 } } as Instance)
            : (i as Instance),
      ),
      chain: [3, 2],
    }

    useRackStore.getState().setFolded(["drums-1", "SONG"], false)
    useRackStore.getState().loadSong(song)
    const s = useRackStore.getState()
    expect(s.bpm).toBe(240)
    // A loaded song opens folded: every machine and the fixed panels, the clock open.
    expect(s.folded["drums-1"]).toBe(true)
    expect(s.folded.SONG).toBe(true)
    expect(s.folded["FX-2"]).toBe(true)
    expect(s.folded.CLOCK).toBeUndefined()
    expect(s.instances.find((i) => i.id === "drums-1")!.send).toBe(1)
    expect((s.instances.find((i) => i.id === "synth-1") as InstanceOf<"synth">).params.cutoff).toBe(
      80,
    )
    expect(s.chain).toEqual([3, 2])
  })

  it("keeps pan, 3D place and the stereo switches, and defaults them where a file lacks them", () => {
    const store = useRackStore.getState()
    store.setInstancePan("perc-1", 0.6)
    store.setInstanceSpace("perc-1", { angle: -90, distance: 0.8 })
    store.setFxParam("pingPong", true)
    store.setFxParam("space", true)
    const song = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(instOf<"perc">(song, "perc-1").pan).toBe(0.6)
    expect(instOf<"perc">(song, "perc-1").space).toEqual({ angle: -90, distance: 0.8 })
    expect(song.fx).toMatchObject({ pingPong: true, space: true })

    // A file from before stereo: centre, the default place, both switches off.
    const old = JSON.parse(serializeSong(song)) as {
      instances: Record<string, unknown>[]
      fx: Record<string, unknown>
    }
    for (const i of old.instances) {
      delete i.pan
      delete i.space
    }
    delete old.fx.pingPong
    delete old.fx.space
    const parsed = parseSong(JSON.stringify(old))
    expect(instOf<"perc">(parsed, "perc-1").pan).toBe(0)
    expect(instOf<"perc">(parsed, "perc-1").space).toEqual({ angle: 0, distance: 0.5 })
    expect(parsed.fx).toMatchObject({ pingPong: false, space: false })
  })

  it("keeps a machine's key, leaves it out when there is none and drops a nonsense one", () => {
    const store = useRackStore.getState()
    store.setInstanceKey("bass-1", { root: 9, scale: "blues", octave: 1 })
    const text = serializeSong(toSong(useRackStore.getState()))
    const song = parseSong(text)
    expect(instOf<"bass">(song, "bass-1").key).toEqual({ root: 9, scale: "blues", octave: 1 })
    expect("key" in instOf<"synth">(song, "synth-1")).toBe(false)

    const raw = JSON.parse(text) as { instances: Record<string, unknown>[] }
    raw.instances.find((i) => i.id === "bass-1")!.key = { root: 40, scale: "whatever", octave: 2 }
    raw.instances.find((i) => i.id === "synth-1")!.key = "F minor"
    raw.instances.find((i) => i.id === "drums-1")!.key = { root: 0, scale: "major", octave: 3 }
    const parsed = parseSong(JSON.stringify(raw))
    expect(instOf<"bass">(parsed, "bass-1").key).toEqual({
      root: 11,
      scale: "minorPentatonic",
      octave: 2,
    })
    expect(instOf<"synth">(parsed, "synth-1").key).toBeUndefined()
    expect(instOf<"drums">(parsed, "drums-1").key).toBeUndefined()
  })

  it("keeps swing through a round-trip and defaults it when the file lacks it", () => {
    useRackStore.getState().setSwing(0.6)
    const song = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(song.swing).toBe(0.6)

    const legacy = JSON.parse(serializeSong(song)) as Record<string, unknown>
    delete legacy.swing
    expect(parseSong(JSON.stringify(legacy)).swing).toBe(0)
  })

  it("keeps an instance silent when a file lacks its track", () => {
    const song = toSong(useRackStore.getState())
    const raw = JSON.parse(serializeSong(song)) as {
      patterns: { tracks: Record<string, unknown> }[]
    }
    delete raw.patterns[0]!.tracks["bass-1"]
    const parsed = parseSong(JSON.stringify(raw))
    const bass = parsed.patterns[0]!.tracks["bass-1"]!
    expect(bass.kind === "bass" && bass.bass.notes.every((n) => n === null)).toBe(true)
  })

  it("lifts a version-1 file into one instance per channel it names, and no more", () => {
    const song = parseSong(rackSongText)

    expect(song.version).toBe(2)
    // The old file only knew DR-4 and MONO-1, so that is the whole rack.
    expect(song.instances.map((i) => i.id)).toEqual(["drums-1", "synth-1"])
    expect(Object.keys(song.patterns[0]!.tracks)).toEqual(["drums-1", "synth-1"])
    expect(kitOf(song, 0, "drums-1").kick!.some(Boolean)).toBe(true)
    expect(instOf<"drums">(song, "drums-1").mute).toBe(false)

    // And it loads into the store like any other song.
    useRackStore.getState().loadSong(song)
    expect(useRackStore.getState().instances).toHaveLength(2)
  })

  it("gives a version-1 channel default params and silent tracks when only the mix names it", () => {
    const raw = JSON.parse(rackSongText) as { mix: { level: Record<string, number> } }
    for (const ch of ["perc", "sampler", "bass", "poly", "ep", "strings"]) raw.mix.level[ch] = 0.5
    const song = parseSong(JSON.stringify(raw))

    expect(song.instances.map((i) => i.id)).toEqual([
      "drums-1",
      "perc-1",
      "sampler-1",
      "synth-1",
      "bass-1",
      "poly-1",
      "ep-1",
      "strings-1",
    ])
    expect(kitOf(song, 0, "perc-1").shaker!.some(Boolean)).toBe(false)
    expect(instOf<"perc">(song, "perc-1").params.crash).toBe(0.5)
    expect(instOf<"bass">(song, "bass-1").params.waveform).toBe("sawtooth")
    expect(
      (song.patterns[0]!.tracks["ep-1"] as PolyTrack).chords.every((c) => c.length === 0),
    ).toBe(true)
    expect(instOf<"poly">(song, "poly-1").params.cutoff).toBe(2200)
    expect(instOf<"ep">(song, "ep-1").params.tone).toBe(2)
    expect(instOf<"strings">(song, "strings-1").params.damp).toBe(STRINGS_PARAMS_DEFAULT.damp)
    // A file from before the sampled guitars gets the default sound.
    expect(instOf<"strings">(song, "strings-1").params.sound).toBe("nylon")
    expect(instOf<"sampler">(song, "sampler-1").params.pad3).toEqual({
      name: null,
      pitch: 0,
      decay: 1,
      level: 0.8,
    })
    expect(instOf<"sampler">(song, "sampler-1").level).toBe(0.5)
    expect(instOf<"perc">(song, "perc-1").send).toBe(0.25)
  })

  it("lifts every sample song in docs/", () => {
    const files = Object.values(SAMPLE_SONGS)
    expect(files.length).toBeGreaterThan(0)
    for (const text of files) {
      const song = parseSong(text)
      expect(song.version).toBe(2)
      // Old four-slot files are topped up to a full bank.
      expect(song.patterns).toHaveLength(PATTERN_COUNT)
      // Round-trips through the new format unchanged.
      expect(parseSong(serializeSong(song))).toEqual(song)
    }
  })

  it("parses every built-in song: sections fit the chain, parts name real machines, keys are kept", () => {
    const files = Object.entries(BUILTIN_SONGS).filter(([file]) => !file.endsWith("/index.json"))
    expect(files.length).toBeGreaterThan(0)
    for (const [file, text] of files) {
      const song = parseSong(text)
      const ids = new Set(song.instances.map((i) => i.id))
      const sectionBars = song.sections.reduce((n, s) => n + s.bars, 0)
      expect(sectionBars === 0 || sectionBars === song.chain.length, file).toBe(true)
      for (const slot of song.chain) expect(slot, file).toBeLessThan(PATTERN_COUNT)
      for (const p of song.patterns) {
        for (const id of Object.keys(p.tracks)) expect(ids.has(id), `${file}: ${id}`).toBe(true)
        for (const id of p.muted ?? []) expect(ids.has(id), `${file}: muted ${id}`).toBe(true)
      }
      expect(parseSong(serializeSong(song))).toEqual(song)
    }
    // The composed demos carry a key on every melodic machine.
    const composed = parseSong(BUILTIN_SONGS["../../public/songs/nit-de-festa.json"]!)
    expect(composed.instances.filter((i) => i.key).map((i) => i.id)).toEqual([
      "bass-1",
      "synth-1",
      "poly-1",
      "ep-1",
    ])
    expect(composed.sections.map((s) => s.name)).toEqual([
      "Intro",
      "Verse",
      "Build",
      "Drop",
      "Break",
      "Drop",
      "Outro",
    ])
  })

  it("pads a shorter bank with silent slots and refuses a longer one", () => {
    const song = toSong(useRackStore.getState())
    const short = JSON.parse(serializeSong(song)) as { patterns: unknown[] }
    short.patterns = short.patterns.slice(0, 4)
    const parsed = parseSong(JSON.stringify(short))
    expect(parsed.patterns).toHaveLength(PATTERN_COUNT)
    expect(kitOf(parsed, 7, "drums-1").kick!.some(Boolean)).toBe(false)

    const long = JSON.parse(serializeSong(song)) as { patterns: unknown[] }
    long.patterns.push(long.patterns[0])
    expect(() => parseSong(JSON.stringify(long))).toThrow(/song\.patterns/)
  })

  it("forgives a hand-written file: missing fx, chain and active slot, rows past the last", () => {
    const song = toSong(useRackStore.getState())
    const loose = JSON.parse(serializeSong(song)) as Record<string, unknown> & {
      patterns: {
        tracks: { "synth-1": { notes: (number | null)[] }; "poly-1": { chords: number[][] } }
      }[]
    }
    delete loose.fx
    delete loose.chain
    delete loose.activePattern
    loose.patterns[0]!.tracks["synth-1"].notes[3] = 10
    loose.patterns[0]!.tracks["poly-1"].chords[0] = [3, 7, 10, -1]
    const parsed = parseSong(JSON.stringify(loose))
    expect(parsed.fx).toEqual(FX_DEFAULT)
    // No chain: every slot with content, in order; the first of them is active.
    const filled = song.patterns.flatMap((p, i) => (isPatternEmpty(p) ? [] : [i]))
    expect(filled.length).toBeGreaterThan(0)
    expect(parsed.chain).toEqual(filled)
    expect(parsed.activePattern).toBe(filled[0])
    const synth = parsed.patterns[0]!.tracks["synth-1"]
    const poly = parsed.patterns[0]!.tracks["poly-1"]
    if (synth?.kind !== "synth" || poly?.kind !== "poly") throw new Error()
    expect(synth.notes[3]).toBe(7)
    expect(poly.chords[0]).toEqual([0, 3, 7])
  })

  it("understands a chatbot's names for machines and lets a track say the same name", () => {
    const loose = {
      version: 2,
      bpm: 100,
      masterVolume: 0.8,
      instances: [
        { id: "pad-1", kind: "pad", params: { cutoff: 1200, attack: 1.5 }, level: 0.5, send: 0.6 },
        { id: "guitar-1", kind: "Guitar", params: {}, level: 0.6, send: 0.3 },
      ],
      patterns: [{ tracks: { "pad-1": { kind: "pad", chords: Array(16).fill([]) } } }],
    }
    const parsed = parseSong(JSON.stringify(loose))
    expect(parsed.instances.map((i) => i.kind)).toEqual(["poly", "strings"])
    const pad = parsed.instances[0]
    if (pad?.kind !== "poly") throw new Error()
    expect(pad.params.cutoff).toBe(1200)
    expect(pad.params.sustain).toBeGreaterThan(0)
    expect(pad.mute).toBe(false)
    expect(parsed.patterns[0]!.tracks["guitar-1"]?.kind).toBe("strings")
  })

  it("rejects files that are not a song", () => {
    expect(() => parseSong("not json")).toThrow(SongParseError)
    expect(() => parseSong("{}")).toThrow(/song\.version/)

    const song = toSong(useRackStore.getState())
    const broken = JSON.parse(serializeSong(song)) as {
      patterns: { tracks: Record<string, unknown> }[]
    }
    broken.patterns[0]!.tracks["drums-1"] = { kind: "drums", rows: {} }
    expect(() => parseSong(JSON.stringify(broken))).toThrow(
      /patterns\[0\]\.tracks\.drums-1\.rows\.kick/,
    )

    const wrongKind = JSON.parse(serializeSong(song)) as {
      patterns: { tracks: Record<string, unknown> }[]
    }
    wrongKind.patterns[0]!.tracks["drums-1"] = { kind: "perc", rows: {} }
    expect(() => parseSong(JSON.stringify(wrongKind))).toThrow(/tracks\.drums-1\.kind/)

    const badNote = JSON.parse(serializeSong(song)) as {
      patterns: { tracks: { "synth-1": { notes: unknown[] } } }[]
    }
    badNote.patterns[0]!.tracks["synth-1"].notes[3] = "high"
    expect(() => parseSong(JSON.stringify(badNote))).toThrow(/notes\[3\]/)

    const badWave = JSON.parse(serializeSong(song)) as {
      instances: { id: string; params: { waveform?: string } }[]
    }
    badWave.instances.find((i) => i.id === "synth-1")!.params.waveform = "noise"
    expect(() => parseSong(JSON.stringify(badWave))).toThrow(/waveform/)

    const badSound = JSON.parse(serializeSong(song)) as {
      instances: { id: string; params: { sound?: string } }[]
    }
    badSound.instances.find((i) => i.id === "strings-1")!.params.sound = "banjo"
    expect(() => parseSong(JSON.stringify(badSound))).toThrow(/sound/)

    const badFilter = JSON.parse(serializeSong(song)) as {
      instances: { id: string; params: { filterType?: string } }[]
    }
    badFilter.instances.find((i) => i.id === "bass-1")!.params.filterType = "comb"
    expect(() => parseSong(JSON.stringify(badFilter))).toThrow(/filterType/)
    // A file from before filter types: the lowpass it was made with.
    delete badFilter.instances.find((i) => i.id === "bass-1")!.params.filterType
    expect(instOf<"bass">(parseSong(JSON.stringify(badFilter)), "bass-1").params.filterType).toBe(
      "lowpass",
    )

    // A strip filter round-trips; a file without one gets a wide-open lowpass.
    useRackStore.getState().setInstanceFilter("drums-1", { type: "bandpass", cutoff: 900 })
    const withFilter = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(instOf<"drums">(withFilter, "drums-1").filter).toEqual({
      type: "bandpass",
      cutoff: 900,
      resonance: 0.1,
    })
    const noFilter = JSON.parse(serializeSong(song)) as {
      instances: { id: string; filter?: unknown }[]
    }
    delete noFilter.instances.find((i) => i.id === "drums-1")!.filter
    expect(instOf<"drums">(parseSong(JSON.stringify(noFilter)), "drums-1").filter).toEqual({
      type: "lowpass",
      cutoff: 20000,
      resonance: 0.1,
    })
    expect(instOf<"synth">(parseSong(JSON.stringify(noFilter)), "synth-1").filter).toBeUndefined()

    // A MIC-1: its loop's name and tempo, whether it is heard live and its loop length round-trip.
    const mic = useRackStore.getState().addInstance("mic")
    useRackStore
      .getState()
      .setInstanceParams(mic.id, { loopName: "Loop · 4 bars", loopBpm: 97, bars: 4, live: false })
    const withMic = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(instOf<"mic">(withMic, mic.id).params).toMatchObject({
      loopName: "Loop · 4 bars",
      loopBpm: 97,
      bars: 4,
      live: false,
    })
    expect(withMic.patterns[0]!.tracks[mic.id]).toMatchObject({ kind: "mic" })
    useRackStore.getState().removeInstance(mic.id)

    // A VID-1: its file name (or null) and loop length round-trip; a bad length falls back.
    const vid = useRackStore.getState().addInstance("video")
    useRackStore.getState().setInstanceParams(vid.id, { videoName: "clip.mov", bars: 8 })
    const withVideo = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(instOf<"video">(withVideo, vid.id).params).toMatchObject({
      videoName: "clip.mov",
      bars: 8,
    })
    expect(withVideo.patterns[0]!.tracks[vid.id]).toMatchObject({ kind: "video" })
    const badBars = JSON.parse(serializeSong(withVideo)) as {
      instances: { id: string; params: { bars?: number; videoName?: unknown } }[]
    }
    badBars.instances.find((i) => i.id === vid.id)!.params.bars = 3
    badBars.instances.find((i) => i.id === vid.id)!.params.videoName = null
    useRackStore.getState().loadSong(parseSong(JSON.stringify(badBars)))
    const loaded = useRackStore
      .getState()
      .instances.find((i) => i.id === vid.id) as InstanceOf<"video">
    expect(loaded.params.bars).toBe(4)
    expect(loaded.params.videoName).toBeNull()
    useRackStore.getState().removeInstance(vid.id)

    // Parts sitting a slot out round-trip; unknown ids are dropped, a missing list means everyone plays.
    useRackStore.getState().togglePartMute("drums-1", 2)
    const withMuted = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(withMuted.patterns[2]!.muted).toEqual(["drums-1"])
    expect(withMuted.patterns[0]!.muted).toBeUndefined()
    const strayMute = JSON.parse(serializeSong(withMuted)) as {
      patterns: { muted?: string[] }[]
    }
    strayMute.patterns[2]!.muted = ["drums-1", "ghost-9"]
    expect(parseSong(JSON.stringify(strayMute)).patterns[2]!.muted).toEqual(["drums-1"])

    // Modulation round-trips, a partial block fills in, a missing one is still.
    useRackStore.getState().setInstanceLfo("synth-1", 0, { target: "cutoff", shape: "square" })
    useRackStore
      .getState()
      .setMacroTargets("synth-1", 1, [{ key: "param:cutoff", min: 100, max: 900 }])
    const withMod = parseSong(serializeSong(toSong(useRackStore.getState())))
    expect(instOf<"synth">(withMod, "synth-1").mod.lfo[0]).toMatchObject({
      target: "cutoff",
      shape: "square",
    })
    expect(instOf<"synth">(withMod, "synth-1").mod.macros[1].targets).toEqual([
      { key: "param:cutoff", min: 100, max: 900 },
    ])
    const partialMod = JSON.parse(serializeSong(song)) as {
      instances: { id: string; mod?: unknown }[]
    }
    partialMod.instances.find((i) => i.id === "bass-1")!.mod = { drive: 0.4, lfo: [{ rate: 3 }] }
    delete partialMod.instances.find((i) => i.id === "drums-1")!.mod
    const lenient = parseSong(JSON.stringify(partialMod))
    expect(instOf<"bass">(lenient, "bass-1").mod.drive).toBe(0.4)
    expect(instOf<"bass">(lenient, "bass-1").mod.lfo[0]).toMatchObject({ rate: 3, target: "off" })
    expect(instOf<"bass">(lenient, "bass-1").mod.lfo[1].rate).toBe(0.25)
    expect(instOf<"drums">(lenient, "drums-1").mod.tune).toBe(0)
    expect(instOf<"drums">(lenient, "drums-1").mod.macros).toHaveLength(4)
    partialMod.instances.find((i) => i.id === "bass-1")!.mod = { lfo: [{ target: "moon" }] }
    expect(() => parseSong(JSON.stringify(partialMod))).toThrow(/lfo\[0\]\.target/)

    const dupe = JSON.parse(serializeSong(song)) as { instances: { id: string }[] }
    dupe.instances[1]!.id = dupe.instances[0]!.id
    expect(() => parseSong(JSON.stringify(dupe))).toThrow(/unique ids/)
  })
})
