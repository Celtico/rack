import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createEmptyPattern,
  toggleBassFlag,
  toggleKitStep,
  toggleTrackNote,
  withTrack,
  type BassFlag,
  type KitTrack,
  type Pattern,
  type TrackOwner,
} from "../state/pattern"
import { resolvePlayingPattern } from "../state/patterns"
import { hitsForStep, Scheduler, swingOffset } from "./scheduler"

// A mocked transport: Sequence captures its callback so the test can fire ticks
// by hand, Draw runs its callback immediately. Hoisted so vi.mock can see it.
const fake = vi.hoisted(() => {
  class FakeSequence {
    started = false
    disposed = false
    readonly callback: (time: number, step: number) => void
    readonly events: number[]
    readonly subdivision: string
    constructor(
      callback: (time: number, step: number) => void,
      events: number[],
      subdivision: string,
    ) {
      this.callback = callback
      this.events = events
      this.subdivision = subdivision
      sequences.push(this)
    }
    start() {
      this.started = true
      return this
    }
    dispose() {
      this.disposed = true
    }
  }
  const sequences: FakeSequence[] = []
  const drawSchedule = vi.fn((cb: () => void, _time: number) => cb())
  return { FakeSequence, sequences, drawSchedule }
})

vi.mock("tone", () => ({
  Sequence: fake.FakeSequence,
  getDraw: () => ({ schedule: fake.drawSchedule }),
}))

/** A rack with two DR-4s, so instance routing is exercised. */
const OWNERS: TrackOwner[] = [
  { id: "drums-1", kind: "drums" },
  { id: "drums-2", kind: "drums" },
  { id: "perc-1", kind: "perc" },
  { id: "sampler-1", kind: "sampler" },
  { id: "synth-1", kind: "synth" },
  { id: "bass-1", kind: "bass" },
  { id: "poly-1", kind: "poly" },
  { id: "strings-1", kind: "strings" },
]
const empty = () => createEmptyPattern(OWNERS)

const hit = (p: Pattern, id: string, voice: string, step: number) =>
  withTrack(p, id, toggleKitStep(p.tracks[id] as KitTrack, voice, step))
const note = (p: Pattern, id: string, step: number, row: number) =>
  withTrack(p, id, toggleTrackNote(p.tracks[id]!, step, row))
const flag = (p: Pattern, id: string, step: number, f: BassFlag) =>
  withTrack(p, id, toggleBassFlag(p.tracks[id]!, step, f))

/** A scheduler over a live bank; `set*` mutate what the next tick will see. */
const SIXTEENTH = 0.125

function makeScheduler(initial: Pattern, chain: number[] = []) {
  let patterns = [initial, empty(), empty(), empty()]
  let active = 0
  let swing = 0
  const trigger = vi.fn()
  const triggerNote = vi.fn()
  const triggerBass = vi.fn()
  const triggerPoly = vi.fn()
  const onStep = vi.fn()
  const getPattern = vi.fn((bar: number) => resolvePlayingPattern(patterns, active, chain, bar))
  const scheduler = new Scheduler({
    getPattern,
    getSwing: () => swing,
    sixteenthSeconds: () => SIXTEENTH,
    trigger,
    triggerNote,
    triggerBass,
    triggerPoly,
    onStep,
  })
  return {
    scheduler,
    trigger,
    triggerNote,
    triggerBass,
    triggerPoly,
    onStep,
    getPattern,
    setPattern: (next: Pattern, slot = 0) => {
      patterns = patterns.map((p, i) => (i === slot ? next : p))
    },
    setActive: (i: number) => {
      active = i
    },
    setSwing: (s: number) => {
      swing = s
    },
  }
}

const playBar = (seq: { callback: (t: number, s: number) => void }, bar: number) => {
  for (let step = 0; step < 16; step++) seq.callback(bar * 2 + step * 0.125, step)
}

describe("hitsForStep", () => {
  it("lists the (instance, voice) pairs that are on at a step, instance by instance", () => {
    let p = empty()
    p = hit(p, "drums-1", "kick", 0)
    p = hit(p, "drums-1", "hat", 0)
    p = hit(p, "drums-2", "kick", 0)
    p = hit(p, "perc-1", "crash", 0)
    p = hit(p, "sampler-1", "pad2", 0)
    p = hit(p, "drums-1", "snare", 4)
    expect(hitsForStep(p, 0)).toEqual([
      ["drums-1", "kick"],
      ["drums-1", "hat"],
      ["drums-2", "kick"],
      ["perc-1", "crash"],
      ["sampler-1", "pad2"],
    ])
    expect(hitsForStep(p, 4)).toEqual([["drums-1", "snare"]])
    expect(hitsForStep(p, 1)).toEqual([])
  })
})

describe("swingOffset", () => {
  it("delays only odd steps, up to a third of a sixteenth at full swing", () => {
    expect(swingOffset(0, 1, SIXTEENTH)).toBe(0)
    expect(swingOffset(2, 1, SIXTEENTH)).toBe(0)
    expect(swingOffset(1, 1, SIXTEENTH)).toBeCloseTo(SIXTEENTH / 3)
    expect(swingOffset(1, 0.5, SIXTEENTH)).toBeCloseTo(SIXTEENTH / 6)
    expect(swingOffset(1, 0, SIXTEENTH)).toBe(0)
  })
})

describe("Scheduler", () => {
  beforeEach(() => {
    fake.sequences.length = 0
    fake.drawSchedule.mockClear()
  })

  it("arms a single 16-step sixteenth-note sequence from the transport start", () => {
    const { scheduler } = makeScheduler(empty())
    scheduler.start()
    scheduler.start()

    expect(fake.sequences).toHaveLength(1)
    const seq = fake.sequences[0]!
    expect(seq.started).toBe(true)
    expect(seq.subdivision).toBe("16n")
    expect(seq.events).toEqual(Array.from({ length: 16 }, (_, i) => i))
  })

  it("fires each instance's voices at the transport time and publishes the step through Draw", () => {
    let pattern = empty()
    pattern = hit(pattern, "drums-1", "kick", 0)
    pattern = hit(pattern, "drums-2", "kick", 0)
    pattern = hit(pattern, "drums-1", "kick", 8)
    pattern = hit(pattern, "drums-2", "snare", 4)

    const { scheduler, trigger, onStep } = makeScheduler(pattern)
    scheduler.start()
    playBar(fake.sequences[0]!, 0)

    expect(trigger.mock.calls).toEqual([
      ["drums-1", "kick", 0],
      ["drums-2", "kick", 0],
      ["drums-2", "snare", 0.5],
      ["drums-1", "kick", 1],
    ])
    expect(onStep.mock.calls).toEqual(Array.from({ length: 16 }, (_, i) => [i, 0, 0]))
    // Every UI update went through Draw with the audio time attached.
    expect(fake.drawSchedule).toHaveBeenCalledTimes(16)
    expect(fake.drawSchedule.mock.calls[4]?.[1]).toBe(0.5)
  })

  it("fires the synth note of a column, and nothing on rests", () => {
    let pattern = empty()
    pattern = note(pattern, "synth-1", 0, 0) // C2
    pattern = note(pattern, "synth-1", 2, 7) // C3

    const { scheduler, triggerNote } = makeScheduler(pattern)
    scheduler.start()
    const seq = fake.sequences[0]!
    for (let step = 0; step < 4; step++) seq.callback(step * 0.125, step)

    expect(triggerNote.mock.calls).toEqual([
      ["synth-1", "C2", 0],
      ["synth-1", "C3", 0.25],
    ])
  })

  it("swings off-beat steps late, for sound and playhead alike, reading the amount per tick", () => {
    let pattern = empty()
    pattern = hit(pattern, "drums-1", "hat", 0)
    pattern = hit(pattern, "drums-1", "hat", 1)
    pattern = note(pattern, "synth-1", 3, 2)

    const { scheduler, trigger, triggerNote, setSwing } = makeScheduler(pattern)
    setSwing(1)
    scheduler.start()
    const seq = fake.sequences[0]!

    for (let step = 0; step < 4; step++) seq.callback(step * SIXTEENTH, step)

    expect(trigger.mock.calls[0]).toEqual(["drums-1", "hat", 0])
    expect(trigger.mock.calls[1]?.[2]).toBeCloseTo(SIXTEENTH + SIXTEENTH / 3)
    expect(triggerNote.mock.calls[0]?.[2]).toBeCloseTo(3 * SIXTEENTH + SIXTEENTH / 3)
    // Draw follows the swung time so the playhead lands with the sound.
    expect(fake.drawSchedule.mock.calls[1]?.[1]).toBeCloseTo(SIXTEENTH + SIXTEENTH / 3)
    expect(fake.drawSchedule.mock.calls[2]?.[1]).toBeCloseTo(2 * SIXTEENTH)

    // Turning swing off mid-bar takes effect on the next off-beat.
    setSwing(0)
    seq.callback(5 * SIXTEENTH, 5)
    expect(fake.drawSchedule.mock.calls[4]?.[1]).toBeCloseTo(5 * SIXTEENTH)
  })

  it("drives the bass every step with note, accent and slide, rests included", () => {
    let pattern = empty()
    pattern = note(pattern, "bass-1", 0, 0) // E1
    pattern = flag(pattern, "bass-1", 0, "accent")
    pattern = flag(pattern, "bass-1", 0, "slide")
    pattern = note(pattern, "bass-1", 1, 5) // E2

    const { scheduler, triggerBass } = makeScheduler(pattern)
    scheduler.start()
    const seq = fake.sequences[0]!
    for (let step = 0; step < 3; step++) seq.callback(step * SIXTEENTH, step)

    expect(triggerBass.mock.calls).toEqual([
      ["bass-1", { note: "E1", accent: true, slide: true }, 0, SIXTEENTH],
      ["bass-1", { note: "E2", accent: false, slide: false }, SIXTEENTH, SIXTEENTH],
      ["bass-1", { note: null, accent: false, slide: false }, 2 * SIXTEENTH, SIXTEENTH],
    ])
  })

  it("sounds chords on the polyphonic instruments and skips their rests", () => {
    let pattern = empty()
    pattern = note(pattern, "poly-1", 0, 0)
    pattern = note(pattern, "poly-1", 0, 2)
    pattern = note(pattern, "strings-1", 1, 7)

    const { scheduler, triggerPoly } = makeScheduler(pattern)
    scheduler.start()
    const seq = fake.sequences[0]!
    for (let step = 0; step < 3; step++) seq.callback(step * SIXTEENTH, step)

    expect(triggerPoly.mock.calls).toEqual([
      ["poly-1", ["C3", "E3"], 0],
      ["strings-1", ["B3"], SIXTEENTH],
    ])
  })

  it("reads the pattern fresh on every tick, not the one captured at start", () => {
    const { scheduler, trigger, setPattern } = makeScheduler(empty())
    scheduler.start()
    const seq = fake.sequences[0]!

    seq.callback(0, 0)
    expect(trigger).not.toHaveBeenCalled()

    setPattern(hit(empty(), "drums-1", "clap", 0))
    seq.callback(2, 0)
    expect(trigger).toHaveBeenCalledWith("drums-1", "clap", 2)
  })

  it("counts bars so a chain advances on step 0, and rewinds on reset", () => {
    const { scheduler, getPattern, onStep, setPattern } = makeScheduler(empty(), [0, 1, 1])
    setPattern(hit(empty(), "drums-1", "hat", 0), 1)
    scheduler.start()
    const seq = fake.sequences[0]!

    playBar(seq, 0)
    playBar(seq, 1)
    playBar(seq, 2)
    playBar(seq, 3)

    const bars = getPattern.mock.calls.map(([bar]) => bar)
    expect(bars.slice(0, 16).every((b) => b === 0)).toBe(true)
    expect(bars[16]).toBe(1)
    expect(bars[47]).toBe(2)
    expect(bars[48]).toBe(3)
    // Slot and bar published with each step: slots 0, 1, 1, then wraps to 0; bars count up.
    const firstSteps = onStep.mock.calls.filter(([step]) => step === 0)
    expect(firstSteps.map(([, slot]) => slot)).toEqual([0, 1, 1, 0])
    expect(firstSteps.map(([, , bar]) => bar)).toEqual([0, 1, 2, 3])

    scheduler.reset()
    getPattern.mockClear()
    playBar(seq, 0)
    expect(getPattern.mock.calls[0]?.[0]).toBe(0)
  })

  it("disposes the sequence and can be re-armed", () => {
    const { scheduler } = makeScheduler(empty())
    scheduler.start()
    scheduler.dispose()
    expect(fake.sequences[0]!.disposed).toBe(true)

    scheduler.start()
    expect(fake.sequences).toHaveLength(2)
  })
})
