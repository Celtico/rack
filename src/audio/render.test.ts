import { describe, expect, it } from "vitest"

import { FX_DEFAULT } from "../state/params"
import { LOOP_BARS, mixInto, renderChunks, renderPlan } from "./render"

describe("renderPlan", () => {
  it("runs the chain once and leaves room for the reverb tail", () => {
    const plan = renderPlan({ bpm: 120, chain: [0, 1, 0], fx: { ...FX_DEFAULT, reverbDecay: 2 } })
    expect(plan.bars).toBe(3)
    expect(plan.barsSeconds).toBeCloseTo(6)
    expect(plan.seconds).toBeCloseTo(9)
  })

  it("loops a chainless song a few bars", () => {
    const plan = renderPlan({ bpm: 60, chain: [], fx: FX_DEFAULT })
    expect(plan.bars).toBe(LOOP_BARS)
    expect(plan.barsSeconds).toBeCloseTo(LOOP_BARS * 4)
  })

  it("caps the tail", () => {
    const plan = renderPlan({ bpm: 120, chain: [0], fx: { ...FX_DEFAULT, reverbDecay: 30 } })
    expect(plan.seconds - plan.barsSeconds).toBe(8)
  })
})

describe("renderChunks", () => {
  it("cuts a song into stretches of CHUNK_BARS, the last one shorter", () => {
    expect(renderChunks(80)).toEqual([
      { start: 0, end: 16 },
      { start: 16, end: 32 },
      { start: 32, end: 48 },
      { start: 48, end: 64 },
      { start: 64, end: 80 },
    ])
    expect(renderChunks(4)).toEqual([{ start: 0, end: 4 }])
    expect(renderChunks(20, 16)).toEqual([
      { start: 0, end: 16 },
      { start: 16, end: 20 },
    ])
  })

  it("sums a stretch onto the mix where it lands, and no further than the mix reaches", () => {
    const mix = new Float32Array([1, 1, 1, 1, 1])
    mixInto(mix, new Float32Array([0.5, 0.5, 0.5, 0.5]), 3)
    expect([...mix]).toEqual([1, 1, 1, 1.5, 1.5])
  })
})
