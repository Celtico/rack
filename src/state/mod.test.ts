import { describe, expect, it } from "vitest"

import {
  clampMod,
  defaultMod,
  macroPatches,
  macroTargetsFor,
  macroValue,
  modSwing,
  modTargetsFor,
  PITCH_MOD_CENTS,
} from "./mod"

describe("mod model", () => {
  it("offers pitch only to kinds with a detune signal, and tune only to melodic kinds", () => {
    expect(modTargetsFor("synth")).toEqual(["off", "cutoff", "pitch", "level", "pan"])
    expect(modTargetsFor("drums")).toEqual(["off", "cutoff", "level", "pan"])
    expect(modTargetsFor("strings")).toEqual(["off", "cutoff", "level", "pan"])
    expect(macroTargetsFor("drums", true).map((t) => t.key)).toEqual([
      "param:kick",
      "param:snare",
      "param:clap",
      "param:hat",
      "filter:cutoff",
      "filter:resonance",
      "mod:drive",
    ])
    expect(macroTargetsFor("synth", false).map((t) => t.key)).toContain("mod:tune")
    expect(macroTargetsFor("sampler", true).map((t) => t.key)).toEqual([
      "filter:cutoff",
      "filter:resonance",
      "mod:drive",
    ])
  })

  it("clamps every field and falls back on bad enums", () => {
    const mod = defaultMod()
    mod.tune = 40.4
    mod.drive = -1
    mod.lfo[0] = { shape: "noise" as never, rate: 100, target: "nowhere" as never, amount: 2 }
    mod.random = { target: "pitch", amount: -3 }
    mod.macros[2] = { value: 7, targets: [{ key: "param:cutoff", min: 100, max: 200 }] }
    const c = clampMod(mod)
    expect(c.tune).toBe(12)
    expect(c.drive).toBe(0)
    expect(c.lfo[0]).toEqual({ shape: "sine", rate: 20, target: "off", amount: 1 })
    expect(c.lfo[1]).toEqual(mod.lfo[1])
    expect(c.random).toEqual({ target: "pitch", amount: 0 })
    expect(c.macros[2].value).toBe(1)
    expect(c.macros[2].targets).toEqual(mod.macros[2].targets)
  })

  it("swings a target by the amount in its own unit", () => {
    expect(modSwing("pitch", 0.5, 1000)).toBe(PITCH_MOD_CENTS / 2)
    expect(modSwing("cutoff", 1, 1000)).toBeCloseTo(900)
    expect(modSwing("level", 0.5, 1000)).toBeCloseTo(0.45)
    expect(modSwing("pan", 0.5, 1000)).toBeCloseTo(0.5)
    expect(modSwing("off", 1, 1000)).toBe(0)
  })

  it("maps a macro onto its targets, grouped by where they go", () => {
    const t = { key: "param:cutoff", min: 200, max: 1200 }
    expect(macroValue(0.5, t)).toBe(700)
    const macro = {
      value: 0,
      targets: [
        t,
        { key: "filter:cutoff", min: 40, max: 40 },
        { key: "mod:drive", min: 0, max: 1 },
      ],
    }
    expect(macroPatches(macro, 0.25)).toEqual({
      params: { cutoff: 450 },
      filter: { cutoff: 40 },
      mod: { drive: 0.25 },
    })
  })
})
