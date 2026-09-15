import { describe, expect, it } from "vitest"

import { undoKey } from "./undoRedo"

const press = (key: string, mods: Partial<Parameters<typeof undoKey>[0]> = {}) =>
  undoKey({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods })

describe("undoKey", () => {
  it("reads ⌘Z / Ctrl+Z as undo and ⇧⌘Z / Ctrl+Y as redo", () => {
    expect(press("z", { metaKey: true })).toBe("undo")
    expect(press("z", { ctrlKey: true })).toBe("undo")
    expect(press("Z", { metaKey: true, shiftKey: true })).toBe("redo")
    expect(press("z", { ctrlKey: true, shiftKey: true })).toBe("redo")
    expect(press("y", { ctrlKey: true })).toBe("redo")
  })

  it("leaves other keys alone", () => {
    expect(press("z")).toBeNull()
    expect(press("y", { metaKey: true })).toBeNull()
    expect(press("z", { metaKey: true, altKey: true })).toBeNull()
    expect(press("x", { metaKey: true })).toBeNull()
  })
})
