import { beforeEach, describe, expect, it } from "vitest"

import { defaultInstances, type InstanceOf } from "./instances"
import { rowsOf, type KitTrack } from "./pattern"
import { createDefaultBank, PATTERN_COUNT } from "./patterns"
import { BPM_MAX, BPM_MIN, selectInstance, selectPattern, selectTrack, useRackStore } from "./store"

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
    })
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

  it("builds and clears the chain immutably, clamping slots and length", () => {
    const store = useRackStore.getState()
    const before = useRackStore.getState().chain
    store.appendToChain(1)
    store.appendToChain(99)
    const mid = useRackStore.getState().chain
    expect(mid).not.toBe(before)
    expect(mid).toEqual([1, PATTERN_COUNT - 1])
    expect(before).toEqual([])

    for (let i = 0; i < 30; i++) store.appendToChain(0)
    expect(useRackStore.getState().chain).toHaveLength(16)

    store.clearChain()
    expect(useRackStore.getState().chain).toEqual([])
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
