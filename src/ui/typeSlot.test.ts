import { describe, expect, it } from "vitest"

import { DIGIT_JOIN_MS, typeSlotDigit } from "./typeSlot"

describe("typeSlotDigit", () => {
  it("picks a pattern by its number", () => {
    expect(typeSlotDigit(null, "3", 0, 1000)).toEqual({
      slot: 2,
      pending: { bar: 0, value: 3, at: 1000 },
    })
  })

  it("ignores anything but a digit, and a lone 0", () => {
    expect(typeSlotDigit(null, "a", 0, 1000)).toBeNull()
    expect(typeSlotDigit(null, "Enter", 0, 1000)).toBeNull()
    expect(typeSlotDigit(null, "0", 0, 1000)).toBeNull()
  })

  it("joins two quick digits on the same bar into 10–16", () => {
    const first = typeSlotDigit(null, "1", 2, 1000)!
    expect(first.slot).toBe(0)
    const second = typeSlotDigit(first.pending, "3", 2, 1000 + DIGIT_JOIN_MS - 1)!
    expect(second.slot).toBe(12)
    const third = typeSlotDigit(first.pending, "0", 2, 1200)!
    expect(third.slot).toBe(9)
  })

  it("does not join when too slow, on another bar, or past the bank", () => {
    const first = typeSlotDigit(null, "1", 2, 1000)!
    expect(typeSlotDigit(first.pending, "3", 2, 1000 + DIGIT_JOIN_MS)!.slot).toBe(2)
    expect(typeSlotDigit(first.pending, "3", 3, 1100)!.slot).toBe(2)
    const two = typeSlotDigit(null, "2", 2, 1000)!
    expect(typeSlotDigit(two.pending, "5", 2, 1100)!.slot).toBe(4)
    // 16 is the last slot; "16" then "1" starts over rather than making 161.
    const sixteen = typeSlotDigit(first.pending, "6", 2, 1100)!
    expect(sixteen.slot).toBe(15)
    expect(typeSlotDigit(sixteen.pending, "1", 2, 1200)!.slot).toBe(0)
  })
})
