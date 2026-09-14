import { describe, expect, it } from "vitest"

import { FX_DEFAULT } from "../state/params"
import { LOOP_BARS, renderPlan } from "./render"

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
