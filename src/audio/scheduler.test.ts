import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyPattern, toggleDrumStep, toggleSynthNote, type Pattern } from "../state/pattern"
import { resolvePlayingPattern } from "../state/patterns"
import { Scheduler, triggersForStep } from "./scheduler"

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

/** A scheduler over a live bank; `set*` mutate what the next tick will see. */
function makeScheduler(initial: Pattern, chain: number[] = []) {
  let patterns = [initial, createEmptyPattern(), createEmptyPattern(), createEmptyPattern()]
  let active = 0
  const trigger = vi.fn()
  const triggerNote = vi.fn()
  const onStep = vi.fn()
  const getPattern = vi.fn((bar: number) => resolvePlayingPattern(patterns, active, chain, bar))
  const scheduler = new Scheduler({ getPattern, trigger, triggerNote, onStep })
  return {
    scheduler,
    trigger,
    triggerNote,
    onStep,
    getPattern,
    setPattern: (next: Pattern, slot = 0) => {
      patterns = patterns.map((p, i) => (i === slot ? next : p))
    },
    setActive: (i: number) => {
      active = i
    },
  }
}

const playBar = (seq: { callback: (t: number, s: number) => void }, bar: number) => {
  for (let step = 0; step < 16; step++) seq.callback(bar * 2 + step * 0.125, step)
}

describe("triggersForStep", () => {
  it("lists the voices that are on at a step", () => {
    let p = createEmptyPattern()
    p = toggleDrumStep(p, "kick", 0)
    p = toggleDrumStep(p, "hat", 0)
    p = toggleDrumStep(p, "snare", 4)
    expect(triggersForStep(p, 0)).toEqual(["kick", "hat"])
    expect(triggersForStep(p, 4)).toEqual(["snare"])
    expect(triggersForStep(p, 1)).toEqual([])
  })
})

describe("Scheduler", () => {
  beforeEach(() => {
    fake.sequences.length = 0
    fake.drawSchedule.mockClear()
  })

  it("arms a single 16-step sixteenth-note sequence from the transport start", () => {
    const { scheduler } = makeScheduler(createEmptyPattern())
    scheduler.start()
    scheduler.start()

    expect(fake.sequences).toHaveLength(1)
    const seq = fake.sequences[0]!
    expect(seq.started).toBe(true)
    expect(seq.subdivision).toBe("16n")
    expect(seq.events).toEqual(Array.from({ length: 16 }, (_, i) => i))
  })

  it("fires the correct voices at the transport time and publishes the step through Draw", () => {
    let pattern = createEmptyPattern()
    pattern = toggleDrumStep(pattern, "kick", 0)
    pattern = toggleDrumStep(pattern, "kick", 8)
    pattern = toggleDrumStep(pattern, "snare", 4)

    const { scheduler, trigger, onStep } = makeScheduler(pattern)
    scheduler.start()
    playBar(fake.sequences[0]!, 0)

    expect(trigger.mock.calls).toEqual([
      ["kick", 0],
      ["snare", 0.5],
      ["kick", 1],
    ])
    expect(onStep.mock.calls).toEqual(Array.from({ length: 16 }, (_, i) => [i, 0]))
    // Every UI update went through Draw with the audio time attached.
    expect(fake.drawSchedule).toHaveBeenCalledTimes(16)
    expect(fake.drawSchedule.mock.calls[4]?.[1]).toBe(0.5)
  })

  it("fires the synth note of a column, and nothing on rests", () => {
    let pattern = createEmptyPattern()
    pattern = toggleSynthNote(pattern, 0, 0) // C2
    pattern = toggleSynthNote(pattern, 2, 7) // C3

    const { scheduler, triggerNote } = makeScheduler(pattern)
    scheduler.start()
    const seq = fake.sequences[0]!
    for (let step = 0; step < 4; step++) seq.callback(step * 0.125, step)

    expect(triggerNote.mock.calls).toEqual([
      ["C2", 0],
      ["C3", 0.25],
    ])
  })

  it("reads the pattern fresh on every tick, not the one captured at start", () => {
    const { scheduler, trigger, setPattern } = makeScheduler(createEmptyPattern())
    scheduler.start()
    const seq = fake.sequences[0]!

    seq.callback(0, 0)
    expect(trigger).not.toHaveBeenCalled()

    setPattern(toggleDrumStep(createEmptyPattern(), "clap", 0))
    seq.callback(2, 0)
    expect(trigger).toHaveBeenCalledWith("clap", 2)
  })

  it("counts bars so a chain advances on step 0, and rewinds on reset", () => {
    const { scheduler, getPattern, onStep, setPattern } = makeScheduler(
      createEmptyPattern(),
      [0, 1, 1],
    )
    setPattern(toggleDrumStep(createEmptyPattern(), "hat", 0), 1)
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
    // Slot published with each step: 0, 1, 1, then wraps to 0.
    const slots = onStep.mock.calls.filter(([step]) => step === 0).map(([, slot]) => slot)
    expect(slots).toEqual([0, 1, 1, 0])

    scheduler.reset()
    getPattern.mockClear()
    playBar(seq, 0)
    expect(getPattern.mock.calls[0]?.[0]).toBe(0)
  })

  it("disposes the sequence and can be re-armed", () => {
    const { scheduler } = makeScheduler(createEmptyPattern())
    scheduler.start()
    scheduler.dispose()
    expect(fake.sequences[0]!.disposed).toBe(true)

    scheduler.start()
    expect(fake.sequences).toHaveLength(2)
  })
})
