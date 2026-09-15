import { describe, expect, it } from "vitest"

import { COALESCE_MS, emptyHistory, HISTORY_LIMIT, record, redo, undo } from "./history"

describe("history", () => {
  it("undoes and redoes in order, and an edit after an undo forgets the redo", () => {
    let h = emptyHistory<number>()
    h = record(h, 0, null, 0)
    h = record(h, 1, null, 1000)
    expect(undo(h, 2)).toMatchObject({ snap: 1 })
    const u1 = undo(h, 2)!
    const u2 = undo(u1.history, u1.snap)!
    expect(u2.snap).toBe(0)
    expect(undo(u2.history, u2.snap)).toBeNull()

    const r1 = redo(u2.history, u2.snap, 3000)!
    expect(r1.snap).toBe(1)
    const r2 = redo(r1.history, r1.snap, 3001)!
    expect(r2.snap).toBe(2)
    expect(redo(r2.history, r2.snap, 3002)).toBeNull()

    const branch = record(u1.history, u1.snap, null, 4000)
    expect(branch.future).toEqual([])
    expect(redo(branch, 9, 4001)).toBeNull()
  })

  it("coalesces quick edits with the same key into one step, keeping the first snapshot", () => {
    let h = emptyHistory<number>()
    h = record(h, 0, "bpm", 0)
    h = record(h, 1, "bpm", COALESCE_MS - 1)
    h = record(h, 2, "bpm", 2 * COALESCE_MS - 2)
    expect(h.past).toHaveLength(1)
    expect(undo(h, 3)!.snap).toBe(0)

    // A different key, a slow repeat, or no key at all: a new step each.
    h = record(h, 3, "swing", 2 * COALESCE_MS)
    h = record(h, 4, "swing", 3 * COALESCE_MS + 1)
    h = record(h, 5, null, 3 * COALESCE_MS + 2)
    h = record(h, 6, null, 3 * COALESCE_MS + 3)
    expect(h.past.map((e) => e.snap)).toEqual([0, 3, 4, 5, 6])
  })

  it("drops the oldest steps past the limit", () => {
    let h = emptyHistory<number>()
    for (let i = 0; i <= HISTORY_LIMIT + 5; i++) h = record(h, i, null, i * 1000)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]!.snap).toBe(6)
  })
})
