import { describe, expect, it } from "vitest"

import { clampParams, createInstance, type InstanceOf } from "./instances"
import { FILTER_RANGES, SYNTH_RANGES } from "./params"
import { randomFilter, randomizeInstance, randomParams } from "./random"

/** A fixed sequence, so the test is the same every run. */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]!
}

describe("random sound", () => {
  it("keeps every synth parameter inside its range, whatever the rng says", () => {
    for (const rng of [() => 0, () => 0.999, seq(0.1, 0.9, 0.5, 0.3)]) {
      const p = randomParams("synth", rng)
      expect(clampParams("synth", p)).toEqual(p)
      expect(p.cutoff).toBeGreaterThanOrEqual(SYNTH_RANGES.cutoff.min)
      expect(p.cutoff).toBeLessThanOrEqual(SYNTH_RANGES.cutoff.max)
      expect(["sawtooth", "square", "triangle", "sine"]).toContain(p.waveform)
    }
  })

  it("spreads frequencies across octaves rather than linearly", () => {
    // Halfway through the rng, a log-uniform cutoff sits at the geometric middle of the range.
    const p = randomParams("synth", () => 0.5)
    expect(p.cutoff).toBeCloseTo(Math.sqrt(SYNTH_RANGES.cutoff.min * SYNTH_RANGES.cutoff.max), 0)
  })

  it("gives kits audible levels and leaves sampler pads alone", () => {
    const drums = randomParams("drums", () => 0)
    for (const level of Object.values(drums)) expect(level).toBeGreaterThanOrEqual(0.45)
    const pads = createInstance("sampler", []) as InstanceOf<"sampler">
    pads.params.pad1.name = "kick.wav"
    const out = randomizeInstance(pads, seq(0.2, 0.7)) as InstanceOf<"sampler">
    expect(out.params.pad1.name).toBe("kick.wav")
    expect(out.filter).toBeDefined()
    expect(out.filter!.cutoff).toBeGreaterThanOrEqual(FILTER_RANGES.cutoff.min)
  })

  it("keeps a random highpass low and a random lowpass high, so nothing goes silent", () => {
    // The first draw picks the type (index 3 of 5 → highpass), the next the cutoff.
    const hp = randomFilter(seq(0.7, 0.99, 0.5))
    expect(hp.type).toBe("highpass")
    expect(hp.cutoff).toBeLessThanOrEqual(600)
    const lp = randomFilter(seq(0.1, 0, 0.5))
    expect(lp.type).toBe("lowpass")
    expect(lp.cutoff).toBeGreaterThanOrEqual(800)
  })

  it("randomizes tune only on melodic kinds and never touches the LFOs or macros", () => {
    const synth = createInstance("synth", [])
    synth.mod.lfo[0] = { ...synth.mod.lfo[0], target: "cutoff" }
    const out = randomizeInstance(synth, () => 0.999)
    expect(out.mod.tune).toBe(6)
    expect(out.mod.drive).toBeCloseTo(0.6, 2)
    expect(out.mod.lfo[0].target).toBe("cutoff")
    expect(randomizeInstance(createInstance("drums", []), () => 0.999).mod.tune).toBe(0)
  })
})
