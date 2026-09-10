import { beforeEach, describe, expect, it } from "vitest"

import { createEmptyPattern } from "./pattern"
import { BPM_MAX, BPM_MIN, selectPattern, useRackStore } from "./store"

describe("rack store", () => {
  beforeEach(() => {
    useRackStore.setState({
      bpm: 120,
      swing: 0,
      playing: false,
      currentStep: -1,
      playingPattern: -1,
      playingBar: -1,
      masterVolume: 0.8,
      patterns: [0, 1, 2, 3].map(() => createEmptyPattern()),
      activePattern: 0,
      chain: [],
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

  it("toggles a drum step in the active pattern without mutating the previous bank", () => {
    const beforeBank = useRackStore.getState().patterns
    const before = selectPattern(useRackStore.getState())
    const beforeKick = before.drums.kick

    useRackStore.getState().toggleDrumStep("kick", 3)
    const afterBank = useRackStore.getState().patterns
    const after = selectPattern(useRackStore.getState())

    expect(afterBank).not.toBe(beforeBank)
    expect(after).not.toBe(before)
    expect(after.drums.kick).not.toBe(beforeKick)
    expect(after.drums.kick[3]).toBe(true)
    expect(beforeKick[3]).toBe(false)
    // Untouched rows and untouched slots are shared, not copied.
    expect(after.drums.snare).toBe(before.drums.snare)
    expect(afterBank[1]).toBe(beforeBank[1])

    useRackStore.getState().toggleDrumStep("kick", 3)
    expect(selectPattern(useRackStore.getState()).drums.kick[3]).toBe(false)
  })

  it("edits follow the active slot", () => {
    const store = useRackStore.getState()
    store.setActivePattern(2)
    store.toggleSynthNote(0, 5)
    const s = useRackStore.getState()
    expect(s.patterns[2]!.synth[0]).toBe(5)
    expect(s.patterns[0]!.synth[0]).toBeNull()
  })

  it("copies the active pattern into another slot and selects it", () => {
    const store = useRackStore.getState()
    store.toggleDrumStep("hat", 7)
    store.copyActivePatternTo(3)
    const s = useRackStore.getState()
    expect(s.activePattern).toBe(3)
    expect(s.patterns[3]!.drums.hat[7]).toBe(true)
    expect(s.patterns[0]!.drums.hat[7]).toBe(true)
  })

  it("builds and clears the chain immutably, clamping slots and length", () => {
    const store = useRackStore.getState()
    const before = useRackStore.getState().chain
    store.appendToChain(1)
    store.appendToChain(9)
    const mid = useRackStore.getState().chain
    expect(mid).not.toBe(before)
    expect(mid).toEqual([1, 3])
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
    store.setChainSlot(1, 7)
    expect(useRackStore.getState().chain).toEqual([0, 3, 2])
    store.removeChainSlot(0)
    expect(useRackStore.getState().chain).toEqual([3, 2])
    store.removeChainSlot(9)
    expect(useRackStore.getState().chain).toEqual([3, 2])
  })

  it("sets channel level and send clamped to 0–1 without mutating the previous mix", () => {
    const before = useRackStore.getState().mix
    useRackStore.getState().setChannelSend("synth", 2)
    useRackStore.getState().setChannelLevel("drums", -1)
    const after = useRackStore.getState().mix

    expect(after).not.toBe(before)
    expect(after.send.synth).toBe(1)
    expect(after.level.drums).toBe(0)
    expect(after.send.drums).toBe(before.send.drums)
    expect(before.send.synth).toBe(0.35)
  })

  it("sets an FX parameter without mutating the previous fx", () => {
    const before = useRackStore.getState().fx
    useRackStore.getState().setFxParam("delayTime", "4n")
    const after = useRackStore.getState().fx

    expect(after).not.toBe(before)
    expect(after.delayTime).toBe("4n")
    expect(after.feedback).toBe(before.feedback)
  })

  it("toggles a PERC-6 step in the active pattern and sets a perc level", () => {
    const store = useRackStore.getState()
    store.togglePercStep("tomLo", 9)
    expect(selectPattern(useRackStore.getState()).perc.tomLo[9]).toBe(true)

    const before = useRackStore.getState().percLevels
    store.setPercLevel("crash", 3)
    const after = useRackStore.getState().percLevels
    expect(after).not.toBe(before)
    expect(after.crash).toBe(1)
    expect(after.rim).toBe(before.rim)
  })

  it("edits a pad's params clamped, selects pads, and mutes a channel", () => {
    const store = useRackStore.getState()
    store.selectPad("pad5")
    store.setPadParam("pad5", "pitch", 40)
    store.setPadParam("pad5", "name", "kick.wav")
    store.toggleSampleStep("pad5", 2)
    store.setChannelMute("sampler", true)
    const s = useRackStore.getState()
    expect(s.selectedPad).toBe("pad5")
    expect(s.pads.pad5.pitch).toBe(12)
    expect(s.pads.pad5.name).toBe("kick.wav")
    expect(s.pads.pad1.name).toBeNull()
    expect(selectPattern(s).samples.pad5[2]).toBe(true)
    expect(s.mix.mute.sampler).toBe(true)
    expect(s.mix.mute.drums).toBe(false)
  })

  it("folds and unfolds a unit, and all units at once", () => {
    useRackStore.getState().toggleFold("DR-4")
    expect(useRackStore.getState().folded["DR-4"]).toBe(true)
    useRackStore.getState().toggleFold("DR-4")
    expect(useRackStore.getState().folded["DR-4"]).toBe(false)

    useRackStore.getState().setFolded(["DR-4", "EP-1"], true)
    expect(useRackStore.getState().folded).toMatchObject({ "DR-4": true, "EP-1": true })
    useRackStore.getState().setFolded(["DR-4"], false)
    expect(useRackStore.getState().folded["DR-4"]).toBe(false)
    expect(useRackStore.getState().folded["EP-1"]).toBe(true)
  })

  it("sets a drum level clamped to 0–1 without mutating the previous levels", () => {
    const before = useRackStore.getState().drumLevels
    useRackStore.getState().setDrumLevel("hat", 1.7)
    const after = useRackStore.getState().drumLevels

    expect(after).not.toBe(before)
    expect(after.hat).toBe(1)
    expect(after.kick).toBe(before.kick)
  })
})
