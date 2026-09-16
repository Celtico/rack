import { beforeEach, describe, expect, it, vi } from "vitest"

import { emptyHistory } from "./history"
import { defaultInstances, type Instance, type InstanceOf } from "./instances"
import { rowsOf, type KitTrack } from "./pattern"
import { createDefaultBank, MAX_CHAIN, PATTERN_COUNT } from "./patterns"
import {
  BPM_MAX,
  BPM_MIN,
  copyTrack,
  selectCanRedo,
  selectCanUndo,
  selectInstance,
  selectPattern,
  selectTrack,
  silencedBySolo,
  toSong,
  useRackStore,
} from "./store"

const kit = (id: string) => rowsOf(selectTrack(useRackStore.getState(), id) as KitTrack)
const inst = <K extends "drums" | "sampler">(id: string) =>
  selectInstance(useRackStore.getState(), id) as InstanceOf<K>

describe("rack store", () => {
  beforeEach(() => {
    const instances = defaultInstances()
    useRackStore.setState({
      bpm: 120,
      swing: 0,
      playing: false,
      currentStep: -1,
      playingPattern: -1,
      playingBar: -1,
      masterVolume: 0.8,
      patterns: createDefaultBank(instances).map((_, i, bank) => (i === 0 ? bank[1]! : bank[i]!)),
      activePattern: 0,
      chain: [],
      followSong: true,
      instances,
      selectedPad: {},
      folded: {},
      solo: {},
      history: emptyHistory(),
      stroke: null,
    })
  })

  it("undoes and redoes edits to the song, one knob turn as one step, and forgets them on a load", () => {
    vi.useFakeTimers({ now: 10_000 })
    try {
      const store = useRackStore.getState()
      expect(selectCanUndo(useRackStore.getState())).toBe(false)
      expect(store.undo()).toBe(false)

      store.toggleStep("drums-1", "kick", 3)
      store.appendToChain(2)
      vi.setSystemTime(11_000)
      store.setBpm(130)
      vi.setSystemTime(11_100)
      store.setBpm(131)
      vi.setSystemTime(11_200)
      store.setBpm(132)
      expect(useRackStore.getState().history.past).toHaveLength(3)

      expect(store.undo()).toBe(true)
      expect(useRackStore.getState().bpm).toBe(120)
      expect(store.undo()).toBe(true)
      expect(useRackStore.getState().chain).toEqual([])
      expect(kit("drums-1").kick![3]).toBe(true)
      expect(store.undo()).toBe(true)
      expect(kit("drums-1").kick![3]).toBe(false)
      expect(store.undo()).toBe(false)

      expect(store.redo()).toBe(true)
      expect(kit("drums-1").kick![3]).toBe(true)
      expect(selectCanRedo(useRackStore.getState())).toBe(true)
      // A new edit after an undo forgets what was ahead.
      store.toggleStep("drums-1", "snare", 0)
      expect(selectCanRedo(useRackStore.getState())).toBe(false)

      store.loadSong(toSong(useRackStore.getState()))
      expect(selectCanUndo(useRackStore.getState())).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it("undoes a painted stroke as one step, however long it took", () => {
    vi.useFakeTimers({ now: 10_000 })
    try {
      const store = useRackStore.getState()
      store.beginStroke()
      store.toggleStep("drums-1", "hat", 0)
      vi.setSystemTime(12_000)
      store.toggleStep("drums-1", "hat", 1)
      vi.setSystemTime(14_000)
      store.toggleStep("drums-1", "hat", 2)
      store.endStroke()
      // The next press is its own step, even right away.
      store.beginStroke()
      store.toggleStep("drums-1", "hat", 3)
      store.endStroke()
      expect(useRackStore.getState().history.past).toHaveLength(2)

      expect(store.undo()).toBe(true)
      expect(kit("drums-1").hat!.slice(0, 4)).toEqual([true, true, true, false])
      expect(store.undo()).toBe(true)
      expect(kit("drums-1").hat!.slice(0, 4)).toEqual([false, false, false, false])
    } finally {
      vi.useRealTimers()
    }
  })

  it("clamps tempo to the allowed range", () => {
    const { setBpm } = useRackStore.getState()
    setBpm(10)
    expect(useRackStore.getState().bpm).toBe(BPM_MIN)
    setBpm(999)
    expect(useRackStore.getState().bpm).toBe(BPM_MAX)
    setBpm(133.6)
    expect(useRackStore.getState().bpm).toBe(134)
  })

  it("clamps swing to 0–1", () => {
    const { setSwing } = useRackStore.getState()
    setSwing(0.66)
    expect(useRackStore.getState().swing).toBe(0.66)
    setSwing(-1)
    expect(useRackStore.getState().swing).toBe(0)
    setSwing(5)
    expect(useRackStore.getState().swing).toBe(1)
  })

  it("clamps master volume to 0–1", () => {
    const { setMasterVolume } = useRackStore.getState()
    setMasterVolume(-1)
    expect(useRackStore.getState().masterVolume).toBe(0)
    setMasterVolume(2)
    expect(useRackStore.getState().masterVolume).toBe(1)
  })

  it("applies transport changes without mutating the previous state", () => {
    const before = useRackStore.getState()
    useRackStore.getState().setPlaying(true)
    useRackStore.getState().setPlayhead(3, 1, 5)
    const after = useRackStore.getState()

    expect(after).not.toBe(before)
    expect(before.playing).toBe(false)
    expect(before.currentStep).toBe(-1)
    expect(after.playing).toBe(true)
    expect(after.currentStep).toBe(3)
    expect(after.playingPattern).toBe(1)
    expect(after.playingBar).toBe(5)
  })

  it("follows the sounding slot while a song plays, and stays put without a chain", () => {
    const store = useRackStore.getState()
    store.setPlayhead(0, 2, 0)
    expect(useRackStore.getState().activePattern).toBe(0)

    store.appendToChain(0)
    store.appendToChain(2)
    store.setPlayhead(0, 2, 1)
    expect(useRackStore.getState().activePattern).toBe(2)
    store.setPlayhead(-1, -1, -1)
    expect(useRackStore.getState().activePattern).toBe(2)
  })

  it("lets a slot picked from the bank loop over the song until the song is resumed", () => {
    const store = useRackStore.getState()
    store.appendToChain(0)
    store.appendToChain(1)
    expect(useRackStore.getState().followSong).toBe(true)

    store.setActivePattern(5)
    expect(useRackStore.getState().followSong).toBe(false)
    store.setPlayhead(0, 5, 3)
    expect(useRackStore.getState().activePattern).toBe(5)

    store.setFollowSong(true)
    store.setPlayhead(0, 1, 4)
    expect(useRackStore.getState().activePattern).toBe(1)
    // Adding a bar means "build the song": it resumes too.
    store.setActivePattern(3)
    store.appendToChain(3)
    expect(useRackStore.getState().followSong).toBe(true)
  })

  it("toggles a step of one instance in the active pattern without mutating the previous bank", () => {
    const beforeBank = useRackStore.getState().patterns
    const before = selectPattern(useRackStore.getState())
    const beforeKick = kit("drums-1").kick!

    useRackStore.getState().toggleStep("drums-1", "kick", 3)
    const afterBank = useRackStore.getState().patterns
    const after = selectPattern(useRackStore.getState())

    expect(afterBank).not.toBe(beforeBank)
    expect(after).not.toBe(before)
    expect(kit("drums-1").kick).not.toBe(beforeKick)
    expect(kit("drums-1").kick![3]).toBe(true)
    expect(beforeKick[3]).toBe(false)
    // Untouched rows, untouched instances and untouched slots are shared, not copied.
    expect(kit("drums-1").snare).toBe(rowsOf(before.tracks["drums-1"] as KitTrack).snare)
    expect(after.tracks["perc-1"]).toBe(before.tracks["perc-1"])
    expect(afterBank[1]).toBe(beforeBank[1])

    useRackStore.getState().toggleStep("drums-1", "kick", 3)
    expect(kit("drums-1").kick![3]).toBe(false)
  })

  it("ignores edits for instances that do not exist", () => {
    const before = useRackStore.getState().patterns
    useRackStore.getState().toggleStep("drums-9", "kick", 3)
    useRackStore.getState().toggleNote("synth-9", 0, 1)
    expect(useRackStore.getState().patterns).toEqual(before)
  })

  it("edits follow the active slot", () => {
    const store = useRackStore.getState()
    store.setActivePattern(2)
    store.toggleNote("synth-1", 0, 5)
    const s = useRackStore.getState()
    const at = (slot: number) => {
      const t = s.patterns[slot]!.tracks["synth-1"]!
      return t.kind === "synth" ? t.notes[0] : undefined
    }
    expect(at(2)).toBe(5)
    expect(at(0)).toBeNull()
  })

  it("copies the active pattern into another slot and selects it", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "hat", 7)
    store.copyActivePatternTo(3)
    const s = useRackStore.getState()
    expect(s.activePattern).toBe(3)
    expect(rowsOf(s.patterns[3]!.tracks["drums-1"] as KitTrack).hat![7]).toBe(true)
    expect(rowsOf(s.patterns[0]!.tracks["drums-1"] as KitTrack).hat![7]).toBe(true)
  })

  it("swaps two slots, renumbering the chain and the slot on screen so nothing sounds different", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "hat", 7)
    store.appendToChain(0)
    store.appendToChain(2)
    store.appendToChain(0)
    const before = useRackStore.getState()
    store.swapPatterns(0, 2)
    const s = useRackStore.getState()
    expect(s.patterns[2]).toBe(before.patterns[0])
    expect(s.patterns[0]).toBe(before.patterns[2])
    expect(s.chain).toEqual([2, 0, 2])
    expect(s.activePattern).toBe(2)
    expect(before.patterns[0]).not.toBe(s.patterns[0])
    store.undo()
    expect(useRackStore.getState().chain).toEqual([0, 2, 0])
    expect(useRackStore.getState().activePattern).toBe(0)
  })

  it("empties every part of a slot, keeping who sits it out, as one undo step", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "hat", 7)
    store.toggleNote("synth-1", 2, 6)
    store.togglePartMute("perc-1", 0)
    store.clearPattern(0)
    const s = useRackStore.getState()
    expect(rowsOf(s.patterns[0]!.tracks["drums-1"] as KitTrack).hat![7]).toBe(false)
    const synth = s.patterns[0]!.tracks["synth-1"]!
    expect(synth.kind === "synth" && synth.notes.every((n) => n === null)).toBe(true)
    expect(s.patterns[0]!.muted).toEqual(["perc-1"])
    store.undo()
    expect(rowsOf(useRackStore.getState().patterns[0]!.tracks["drums-1"] as KitTrack).hat![7]).toBe(
      true,
    )
  })

  it("copies any slot onto another, leaving the slot on screen alone", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "hat", 7)
    store.copyPattern(0, 5)
    const s = useRackStore.getState()
    expect(s.activePattern).toBe(0)
    expect(rowsOf(s.patterns[5]!.tracks["drums-1"] as KitTrack).hat![7]).toBe(true)
    expect(rowsOf(s.patterns[0]!.tracks["drums-1"] as KitTrack).hat![7]).toBe(true)
  })

  it("builds and clears the chain immutably, clamping slots and length", () => {
    const store = useRackStore.getState()
    const before = useRackStore.getState().chain
    store.appendToChain(1)
    store.appendToChain(99)
    const mid = useRackStore.getState().chain
    expect(mid).not.toBe(before)
    expect(mid).toEqual([1, PATTERN_COUNT - 1])
    expect(before).toEqual([])

    for (let i = 0; i < MAX_CHAIN + 10; i++) store.appendToChain(0)
    expect(useRackStore.getState().chain).toHaveLength(MAX_CHAIN)

    store.clearChain()
    expect(useRackStore.getState().chain).toEqual([])
  })

  it("builds a song from sections and keeps them in step with the bars", () => {
    const store = useRackStore.getState()
    store.appendToChain(0)
    store.appendToChain(0)
    // The first section names the bars the song already had.
    store.addSection("Verse", 4, 1)
    expect(useRackStore.getState().chain).toEqual([0, 0, 1, 1, 1, 1])
    expect(useRackStore.getState().sections).toEqual([
      { name: "Part 1", bars: 2 },
      { name: "Verse", bars: 4 },
    ])
    // Bars appended one at a time join the last section; one removed leaves its own.
    store.repeatLastBar()
    store.removeChainSlot(0)
    expect(useRackStore.getState().sections).toEqual([
      { name: "Part 1", bars: 1 },
      { name: "Verse", bars: 5 },
    ])
    store.setSectionBars(1, 3)
    expect(useRackStore.getState().chain).toEqual([0, 1, 1, 1])
    store.setSectionBars(0, 3)
    expect(useRackStore.getState().chain).toEqual([0, 0, 0, 1, 1, 1])
    store.fillSection(0, 5)
    expect(useRackStore.getState().chain).toEqual([5, 5, 5, 1, 1, 1])
    store.renameSection(0, "  Intro  ")
    expect(useRackStore.getState().sections[0]).toEqual({ name: "Intro", bars: 3 })
    store.duplicateSection(1)
    expect(useRackStore.getState().chain).toEqual([5, 5, 5, 1, 1, 1, 1, 1, 1])
    expect(useRackStore.getState().sections.map((s) => s.name)).toEqual(["Intro", "Verse", "Verse"])
    store.fillSection(2, 2)
    store.moveSection(2, -1)
    expect(useRackStore.getState().chain).toEqual([5, 5, 5, 2, 2, 2, 1, 1, 1])
    store.moveSection(0, -1)
    expect(useRackStore.getState().chain).toEqual([5, 5, 5, 2, 2, 2, 1, 1, 1])
    store.repeatChain()
    expect(useRackStore.getState().sections).toHaveLength(6)
    expect(useRackStore.getState().chain).toHaveLength(18)
    store.removeSection(0)
    expect(useRackStore.getState().chain).toEqual([2, 2, 2, 1, 1, 1, 5, 5, 5, 2, 2, 2, 1, 1, 1])
    expect(useRackStore.getState().sections).toHaveLength(5)
    // Undo works a whole section at a time.
    store.undo()
    expect(useRackStore.getState().chain).toHaveLength(18)
    store.clearChain()
    expect(useRackStore.getState().sections).toEqual([])
  })

  it("lays out a whole structure on the slot on screen", () => {
    const store = useRackStore.getState()
    store.setActivePattern(3)
    store.applyStructure([
      { name: "Intro", bars: 4 },
      { name: "Chorus", bars: 8 },
    ])
    const s = useRackStore.getState()
    expect(s.chain).toEqual(Array.from({ length: 12 }, () => 3))
    expect(s.sections).toEqual([
      { name: "Intro", bars: 4 },
      { name: "Chorus", bars: 8 },
    ])
    expect(s.followSong).toBe(true)
  })

  it("edits and removes single bars of the chain", () => {
    const store = useRackStore.getState()
    store.appendToChain(0)
    store.appendToChain(1)
    store.appendToChain(2)
    store.setChainSlot(1, 3)
    expect(useRackStore.getState().chain).toEqual([0, 3, 2])
    // Out-of-range slots clamp to the last one.
    store.setChainSlot(1, 99)
    expect(useRackStore.getState().chain).toEqual([0, PATTERN_COUNT - 1, 2])
    store.removeChainSlot(0)
    expect(useRackStore.getState().chain).toEqual([PATTERN_COUNT - 1, 2])
    store.removeChainSlot(99)
    expect(useRackStore.getState().chain).toEqual([PATTERN_COUNT - 1, 2])
  })

  it("sets an instance's level, send and mute clamped, without mutating the previous list", () => {
    const before = useRackStore.getState().instances
    useRackStore.getState().setInstanceSend("synth-1", 2)
    useRackStore.getState().setInstanceLevel("drums-1", -1)
    useRackStore.getState().setInstanceMute("sampler-1", true)
    const after = useRackStore.getState().instances

    expect(after).not.toBe(before)
    expect(selectInstance(useRackStore.getState(), "synth-1")!.send).toBe(1)
    expect(selectInstance(useRackStore.getState(), "drums-1")!.level).toBe(0)
    expect(selectInstance(useRackStore.getState(), "sampler-1")!.mute).toBe(true)
    expect(selectInstance(useRackStore.getState(), "drums-1")!.mute).toBe(false)
    expect(before.find((i) => i.id === "synth-1")!.send).toBe(0.35)
    expect(after.find((i) => i.id === "perc-1")).toBe(before.find((i) => i.id === "perc-1"))
  })

  it("solos machines: the others fall silent, a removed or reloaded machine drops it", () => {
    const store = useRackStore.getState()
    expect(silencedBySolo(useRackStore.getState().solo, "drums-1")).toBe(false)

    store.setInstanceSolo("synth-1", true)
    store.setInstanceSolo("no-such-unit", true)
    expect(useRackStore.getState().solo).toEqual({ "synth-1": true })
    expect(silencedBySolo(useRackStore.getState().solo, "drums-1")).toBe(true)
    expect(silencedBySolo(useRackStore.getState().solo, "synth-1")).toBe(false)

    store.setInstanceSolo("drums-1", true)
    store.setInstanceSolo("synth-1", false)
    expect(useRackStore.getState().solo).toEqual({ "drums-1": true })

    store.removeInstance("drums-1")
    expect(useRackStore.getState().solo).toEqual({})
    expect(silencedBySolo(useRackStore.getState().solo, "synth-1")).toBe(false)

    store.setInstanceSolo("synth-1", true)
    store.loadSong(toSong(useRackStore.getState()))
    expect(useRackStore.getState().solo).toEqual({})
  })

  it("sets an FX parameter without mutating the previous fx", () => {
    const before = useRackStore.getState().fx
    useRackStore.getState().setFxParam("delayTime", "4n")
    const after = useRackStore.getState().fx

    expect(after).not.toBe(before)
    expect(after.delayTime).toBe("4n")
    expect(after.feedback).toBe(before.feedback)
  })

  it("patches instance params clamped to their ranges", () => {
    const store = useRackStore.getState()
    const before = inst<"drums">("drums-1").params
    store.setInstanceParams("drums-1", { hat: 1.7 })
    const after = inst<"drums">("drums-1").params
    expect(after).not.toBe(before)
    expect(after.hat).toBe(1)
    expect(after.kick).toBe(before.kick)

    const pad5 = inst<"sampler">("sampler-1").params.pad5
    store.setInstanceParams("sampler-1", { pad5: { ...pad5, pitch: 40, name: "kick.wav" } })
    expect(inst<"sampler">("sampler-1").params.pad5.pitch).toBe(12)
    expect(inst<"sampler">("sampler-1").params.pad5.name).toBe("kick.wav")
    expect(inst<"sampler">("sampler-1").params.pad1.name).toBeNull()
  })

  it("remembers the selected pad per sampler", () => {
    useRackStore.getState().selectPad("sampler-1", "pad5")
    useRackStore.getState().selectPad("sampler-2", "pad2")
    expect(useRackStore.getState().selectedPad).toEqual({
      "sampler-1": "pad5",
      "sampler-2": "pad2",
    })
  })

  it("folds and unfolds a unit, and all units at once", () => {
    useRackStore.getState().toggleFold("drums-1")
    expect(useRackStore.getState().folded["drums-1"]).toBe(true)
    useRackStore.getState().toggleFold("drums-1")
    expect(useRackStore.getState().folded["drums-1"]).toBe(false)

    useRackStore.getState().setFolded(["drums-1", "ep-1"], true)
    expect(useRackStore.getState().folded).toMatchObject({ "drums-1": true, "ep-1": true })
    useRackStore.getState().setFolded(["drums-1"], false)
    expect(useRackStore.getState().folded["drums-1"]).toBe(false)
    expect(useRackStore.getState().folded["ep-1"]).toBe(true)
  })

  it("copies a machine's sound and part onto another of its kind, and duplicates it after itself", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "kick", 0)
    store.setInstanceParams("drums-1", { hat: 0.2 })
    store.setInstanceLevel("drums-1", 0.5)
    const second = store.addInstance("drums")
    store.setInstanceLevel(second.id, 0.9)

    expect(store.copyInstance("drums-1", "synth-1")).toBe(false)
    expect(store.copyInstance("drums-1", "drums-1")).toBe(false)
    expect(store.copyInstance("drums-1", second.id)).toBe(true)
    expect(kit(second.id).kick![0]).toBe(true)
    expect(inst<"drums">(second.id).params.hat).toBe(0.2)
    expect(inst<"drums">(second.id).level).toBe(0.9)
    // A copy, not a shared track: editing one leaves the other alone.
    store.toggleStep(second.id, "kick", 0)
    expect(kit("drums-1").kick![0]).toBe(true)

    const dup = store.duplicateInstance("drums-1")!
    const s = useRackStore.getState()
    expect(dup.id).toBe("drums-3")
    expect(s.instances.map((i) => i.id).slice(0, 2)).toEqual(["drums-1", "drums-3"])
    expect(inst<"drums">("drums-3").level).toBe(0.5)
    expect(inst<"drums">("drums-3").params.hat).toBe(0.2)
    expect(kit("drums-3").kick![0]).toBe(true)
    expect(store.duplicateInstance("no-such")).toBeNull()

    // Both are undone as one step each.
    store.undo()
    expect(useRackStore.getState().instances.some((i) => i.id === "drums-3")).toBe(false)
  })

  it("repeats the last bar or the whole chain, never past the limit", () => {
    const store = useRackStore.getState()
    store.repeatLastBar()
    store.repeatChain()
    expect(useRackStore.getState().chain).toEqual([])

    store.appendToChain(2)
    store.appendToChain(5)
    store.setFollowSong(false)
    store.repeatLastBar()
    expect(useRackStore.getState().chain).toEqual([2, 5, 5])
    expect(useRackStore.getState().followSong).toBe(true)
    store.repeatChain()
    expect(useRackStore.getState().chain).toEqual([2, 5, 5, 2, 5, 5])

    useRackStore.setState({ chain: Array.from({ length: MAX_CHAIN - 2 }, (_, i) => i % 3) })
    store.repeatChain()
    expect(useRackStore.getState().chain).toHaveLength(MAX_CHAIN)
    expect(useRackStore.getState().chain.slice(-2)).toEqual([0, 1])
    store.repeatLastBar()
    expect(useRackStore.getState().chain).toHaveLength(MAX_CHAIN)
  })

  it("gives kits, sampler, EP-1 and STR-6 a strip filter, clamped, and the synths none", () => {
    const store = useRackStore.getState()
    const s = useRackStore.getState()
    expect(selectInstance(s, "drums-1")!.filter).toEqual({
      type: "lowpass",
      cutoff: 20000,
      resonance: 0.1,
    })
    expect(selectInstance(s, "synth-1")!.filter).toBeUndefined()

    store.setInstanceFilter("drums-1", { type: "highpass", cutoff: 5 })
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter).toEqual({
      type: "highpass",
      cutoff: 40,
      resonance: 0.1,
    })
    store.setInstanceFilter("synth-1", { cutoff: 100 })
    expect(selectInstance(useRackStore.getState(), "synth-1")!.filter).toBeUndefined()

    store.undo()
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter!.type).toBe("lowpass")
  })

  it("edits tune, drive, LFOs and random clamped, and a macro moves what it is assigned to", () => {
    const store = useRackStore.getState()
    store.setInstanceMod("synth-1", { tune: 30, drive: 0.3 })
    store.setInstanceLfo("synth-1", 1, { target: "pitch", rate: 0, amount: 0.75 })
    store.setInstanceRandom("drums-1", { target: "cutoff", amount: 9 })
    let s = useRackStore.getState()
    expect(selectInstance(s, "synth-1")!.mod.tune).toBe(12)
    expect(selectInstance(s, "synth-1")!.mod.drive).toBe(0.3)
    expect(selectInstance(s, "synth-1")!.mod.lfo[1]).toMatchObject({
      target: "pitch",
      rate: 0.05,
      amount: 0.75,
    })
    expect(selectInstance(s, "synth-1")!.mod.lfo[0].target).toBe("off")
    expect(selectInstance(s, "drums-1")!.mod.random).toEqual({ target: "cutoff", amount: 1 })

    store.setMacroTargets("synth-1", 0, [
      { key: "param:cutoff", min: 200, max: 1200 },
      { key: "mod:drive", min: 0, max: 1 },
    ])
    expect(store.setMacro("synth-1", 0, 0.5)).toEqual({
      params: { cutoff: 700 },
      filter: {},
      mod: { drive: 0.5 },
    })
    s = useRackStore.getState()
    expect((selectInstance(s, "synth-1") as InstanceOf<"synth">).params.cutoff).toBe(700)
    expect(selectInstance(s, "synth-1")!.mod.drive).toBe(0.5)
    expect(selectInstance(s, "synth-1")!.mod.macros[0].value).toBe(0.5)
    expect(store.setMacro("synth-1", 9, 0.5)).toBeNull()
    expect(store.setMacro("no-such", 0, 0.5)).toBeNull()

    store.setMacroTargets("drums-1", 3, [{ key: "filter:cutoff", min: 100, max: 2000 }])
    expect(store.setMacro("drums-1", 3, 1)).toEqual({
      params: {},
      filter: { cutoff: 2000 },
      mod: {},
    })
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter!.cutoff).toBe(2000)

    store.undo()
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter!.cutoff).toBe(20000)
  })

  it("loads a song saved before filters and modulation existed, filling in what it lacks", () => {
    const song = toSong(useRackStore.getState())
    const stale = song.instances.map((i) => {
      const { filter: _f, mod: _m, ...rest } = i as Instance & { filter?: unknown; mod?: unknown }
      return rest as Instance
    })
    stale[0]!.mod = { drive: 0.3, lfo: [{ target: "level" }] } as never
    useRackStore.getState().loadSong({ ...song, instances: stale })
    const s = useRackStore.getState()
    expect(selectInstance(s, "drums-1")!.filter).toEqual({
      type: "lowpass",
      cutoff: 20000,
      resonance: 0.1,
    })
    expect(selectInstance(s, "drums-1")!.mod.drive).toBe(0.3)
    expect(selectInstance(s, "drums-1")!.mod.lfo[0]).toMatchObject({ target: "level", rate: 1 })
    expect(selectInstance(s, "drums-1")!.mod.macros).toHaveLength(4)
    expect(selectInstance(s, "synth-1")!.mod.tune).toBe(0)
    expect(selectInstance(s, "synth-1")!.filter).toBeUndefined()
  })

  it("randomizes and resets a machine's filter — the synth's own, or the strip's", () => {
    const store = useRackStore.getState()
    store.randomizeFilter("synth-1", () => 0.999)
    let synth = selectInstance(useRackStore.getState(), "synth-1") as InstanceOf<"synth">
    expect(synth.params.cutoff).toBeGreaterThan(7500)
    expect(synth.params.filterType).toBe("notch")
    store.resetFilter("synth-1")
    synth = selectInstance(useRackStore.getState(), "synth-1") as InstanceOf<"synth">
    expect(synth.params).toMatchObject({ filterType: "lowpass", cutoff: 1200, resonance: 2 })

    store.randomizeFilter("drums-1", () => 0)
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter!.cutoff).toBeCloseTo(800, 0)
    store.resetFilter("drums-1")
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter!.cutoff).toBe(20000)
    store.undo()
    expect(selectInstance(useRackStore.getState(), "drums-1")!.filter!.cutoff).toBeCloseTo(800, 0)
  })

  it("lets a machine sit a slot out, on the pattern on screen or a given one", () => {
    const store = useRackStore.getState()
    store.togglePartMute("drums-1")
    store.togglePartMute("synth-1", 3)
    store.togglePartMute("no-such")
    const s = useRackStore.getState()
    expect(s.patterns[0]!.muted).toEqual(["drums-1"])
    expect(s.patterns[3]!.muted).toEqual(["synth-1"])
    expect(s.patterns[1]!.muted).toBeUndefined()
    // Editing the part keeps the mute; copying the slot carries it along.
    store.toggleStep("drums-1", "kick", 0)
    expect(useRackStore.getState().patterns[0]!.muted).toEqual(["drums-1"])
    store.copyActivePatternTo(5)
    expect(useRackStore.getState().patterns[5]!.muted).toEqual(["drums-1"])
    store.togglePartMute("drums-1", 0)
    expect(useRackStore.getState().patterns[0]!.muted).toBeUndefined()
    store.undo()
    expect(useRackStore.getState().patterns[0]!.muted).toEqual(["drums-1"])
  })

  it("writes a random part into the pattern on screen only, as one undo step", () => {
    const store = useRackStore.getState()
    store.setActivePattern(2)
    const before = useRackStore.getState().patterns
    store.randomizePart("synth-1", () => 0)
    const s = useRackStore.getState()
    const track = s.patterns[2]!.tracks["synth-1"]!
    const line = "notes" in track ? track.notes : []
    expect(line.every((r) => r !== null)).toBe(true)
    expect(s.patterns[0]).toBe(before[0])
    store.undo()
    expect(useRackStore.getState().patterns[2]).toBe(before[2])
  })

  it("pastes a copied track into another bank slot, of the same kind only", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "kick", 5)
    const track = copyTrack(selectTrack(useRackStore.getState(), "drums-1")!)

    expect(store.setTrack("synth-1", 3, track)).toBe(false)
    expect(store.setTrack("drums-1", 3, track)).toBe(true)
    const s = useRackStore.getState()
    expect(rowsOf(s.patterns[3]!.tracks["drums-1"] as KitTrack).kick![5]).toBe(true)
    // A copy of the copy: the slot does not share arrays with the clipboard.
    expect(s.patterns[3]!.tracks["drums-1"]).not.toBe(track)
    expect(store.setTrack("drums-1", 99, track)).toBe(true)
    expect(
      rowsOf(useRackStore.getState().patterns.at(-1)!.tracks["drums-1"] as KitTrack).kick![5],
    ).toBe(true)

    store.undo()
    expect(
      rowsOf(useRackStore.getState().patterns.at(-1)!.tracks["drums-1"] as KitTrack).kick![5],
    ).toBe(false)
  })

  it("adds a second machine of a kind with its own empty tracks in every slot", () => {
    const store = useRackStore.getState()
    store.toggleStep("drums-1", "kick", 0)
    const added = store.addInstance("drums")
    const s = useRackStore.getState()

    expect(added.id).toBe("drums-2")
    expect(added.kind).toBe("drums")
    expect(s.instances.at(-1)).toBe(added)
    for (const p of s.patterns) {
      expect(p.tracks["drums-2"]!.kind).toBe("drums")
      expect(rowsOf(p.tracks["drums-2"] as KitTrack).kick!.some(Boolean)).toBe(false)
    }
    expect(kit("drums-1").kick![0]).toBe(true)

    store.toggleStep("drums-2", "snare", 2)
    expect(kit("drums-2").snare![2]).toBe(true)
    expect(kit("drums-1").snare![2]).toBe(false)

    // Ids never repeat, even after a removal.
    store.removeInstance("drums-2")
    expect(useRackStore.getState().addInstance("drums").id).toBe("drums-2")
    expect(useRackStore.getState().addInstance("drums").id).toBe("drums-3")
  })

  it("removes a machine with its tracks and can put it back where it was", () => {
    const store = useRackStore.getState()
    store.toggleStep("perc-1", "rim", 1)
    store.setActivePattern(2)
    store.toggleStep("perc-1", "crash", 0)
    const index = useRackStore.getState().instances.findIndex((i) => i.id === "perc-1")

    const removed = store.removeInstance("perc-1")
    expect(removed).not.toBeNull()
    expect(removed!.index).toBe(index)
    expect(useRackStore.getState().instances.some((i) => i.id === "perc-1")).toBe(false)
    for (const p of useRackStore.getState().patterns) expect(p.tracks["perc-1"]).toBeUndefined()
    expect(store.removeInstance("perc-1")).toBeNull()

    store.restoreInstance(removed!)
    const s = useRackStore.getState()
    expect(s.instances[index]!.id).toBe("perc-1")
    expect(rowsOf(s.patterns[0]!.tracks["perc-1"] as KitTrack).rim![1]).toBe(true)
    expect(rowsOf(s.patterns[2]!.tracks["perc-1"] as KitTrack).crash![0]).toBe(true)
    expect(rowsOf(s.patterns[1]!.tracks["perc-1"] as KitTrack).rim!.some(Boolean)).toBe(false)

    // Restoring twice is a no-op.
    store.restoreInstance(removed!)
    expect(useRackStore.getState().instances.filter((i) => i.id === "perc-1")).toHaveLength(1)
  })
})
