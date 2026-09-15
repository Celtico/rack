import { describe, expect, it } from "vitest"

import { brightnessOf, regionEnd, restartsAt } from "./videoLoops"

describe("video loop maths", () => {
  it("reads a frame's brightness as its mean luma", () => {
    const black = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255])
    const white = new Uint8ClampedArray([255, 255, 255, 255])
    const green = new Uint8ClampedArray([0, 255, 0, 255])
    expect(brightnessOf(black)).toBe(0)
    expect(brightnessOf(white)).toBeCloseTo(1, 3)
    expect(brightnessOf(green)).toBeCloseTo(0.7152, 3)
    expect(brightnessOf(new Uint8ClampedArray([]))).toBe(0)
  })

  it("starts the loop over every N bars, from the first", () => {
    expect(restartsAt(0, 4)).toBe(true)
    expect(restartsAt(3, 4)).toBe(false)
    expect(restartsAt(4, 4)).toBe(true)
    expect(restartsAt(5, 1)).toBe(true)
    expect(restartsAt(2, 0)).toBe(true)
  })

  it("ends the region at the out point, or at the file's end when none is set or it is past it", () => {
    expect(regionEnd(0, 27.8)).toBe(27.8)
    expect(regionEnd(10, 27.8)).toBe(10)
    expect(regionEnd(40, 27.8)).toBe(27.8)
  })
})
