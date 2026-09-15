import { describe, expect, it } from "vitest"

import { curveX, filterCurve, filterGainDb } from "./filterCurve"

describe("filterGainDb", () => {
  it("lowpass passes below the cutoff, falls above it, and peaks by Q dB at the corner", () => {
    expect(filterGainDb("lowpass", 1000, 0, 50)).toBeCloseTo(0, 1)
    expect(filterGainDb("lowpass", 1000, 0, 8000)).toBeLessThan(-40)
    // 12 dB of resonance per stage, two stages.
    expect(filterGainDb("lowpass", 1000, 12, 1000)).toBeCloseTo(24, 0)
  })

  it("highpass is the mirror image", () => {
    expect(filterGainDb("highpass", 1000, 0, 16000)).toBeCloseTo(0, 0)
    expect(filterGainDb("highpass", 1000, 0, 100)).toBeLessThan(-40)
  })

  it("bandpass peaks at the cutoff and notch dips there", () => {
    expect(filterGainDb("bandpass", 1000, 4, 1000)).toBeCloseTo(0, 1)
    expect(filterGainDb("bandpass", 1000, 4, 100)).toBeLessThan(-20)
    expect(filterGainDb("notch", 1000, 4, 1000)).toBeLessThan(-60)
    expect(filterGainDb("notch", 1000, 4, 100)).toBeCloseTo(0, 1)
  })
})

describe("filterCurve", () => {
  it("samples the axis from 20 Hz to 20 kHz, evenly in log frequency", () => {
    const curve = filterCurve("lowpass", 500, 0, 5)
    expect(curve).toHaveLength(5)
    expect(curve[0]).toBeCloseTo(0, 1)
    expect(curve[4]).toBeLessThan(-40)
    expect(curveX(20)).toBe(0)
    expect(curveX(20000)).toBeCloseTo(1)
    expect(curveX(Math.sqrt(20 * 20000))).toBeCloseTo(0.5)
  })
})
