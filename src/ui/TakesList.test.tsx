import "fake-indexeddb/auto"

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { listTakes, saveTake } from "../audio/sampleStore"
import { renderWithChakra } from "../test/render"
import { takeMeta } from "./takes"
import { TakesList } from "./TakesList"

describe("takes", () => {
  it("lists what was recorded, newest first, lets one be used and deletes one", async () => {
    const bytes = new ArrayBuffer(8)
    const clip = await saveTake({ name: "Mic 1.webm", data: bytes, type: "audio/webm" })
    // Later means a later key.
    await new Promise((r) => setTimeout(r, 2))
    const loop = await saveTake({ name: "Loop · 2 bars", data: bytes, bars: 2, bpm: 120 })
    expect((await listTakes()).map((t) => t.key)).toEqual([loop, clip])
    expect(takeMeta((await listTakes())[0]!)).toMatch(/^2 bars · 120 BPM · /)

    const onUse = vi.fn()
    const onDeleted = vi.fn()
    renderWithChakra(<TakesList using={loop} onUse={onUse} onDeleted={onDeleted} />)
    const rows = await screen.findAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute("data-using")

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /^Use Mic 1\.webm/ }))
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ key: clip, name: "Mic 1.webm" }))

    await user.click(screen.getByRole("button", { name: "Delete Loop · 2 bars" }))
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))
    expect(onDeleted).toHaveBeenCalledWith(loop)
    expect((await listTakes()).map((t) => t.key)).toEqual([clip])
  })
})
