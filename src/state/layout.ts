import { create } from "zustand"
import { persist } from "zustand/middleware"

/** Every unit in the rack, in factory order. Ids are the model names on the panels. */
export const UNIT_IDS = [
  "TRANSPORT",
  "PATTERN",
  "SONG",
  "DR-4",
  "PERC-6",
  "SMP-8",
  "BASS-2",
  "MONO-1",
  "POLY-4",
  "EP-1",
  "STR-6",
  "FX-2",
] as const
export type UnitId = (typeof UNIT_IDS)[number]

/** Units that cannot be taken out of the rack. */
export const FIXED_UNITS: readonly UnitId[] = ["TRANSPORT"]

export interface LayoutState {
  /** Visible order of the units. */
  order: readonly UnitId[]
  /** Units taken out of the rack (still exist, just not shown). */
  hidden: readonly UnitId[]

  /** Put `id` where `target` is; `target` shifts to make room. */
  moveUnit: (id: UnitId, target: UnitId) => void
  /** Move one place up or down. */
  nudgeUnit: (id: UnitId, direction: -1 | 1) => void
  hideUnit: (id: UnitId) => void
  showUnit: (id: UnitId) => void
}

/** Reorders `order` so that `id` lands at `target`'s index. Pure. */
export function moveWithin<T>(order: readonly T[], id: T, target: T): T[] {
  if (id === target) return [...order]
  const without = order.filter((x) => x !== id)
  const at = without.indexOf(target)
  if (at < 0 || !order.includes(id)) return [...order]
  // Dropping below the dragged item's old place lands after the target, above lands before.
  const insertAt = order.indexOf(id) < order.indexOf(target) ? at + 1 : at
  without.splice(insertAt, 0, id)
  return without
}

/**
 * How the rack is arranged on screen — order and which units are out. UI
 * preference, kept in the browser rather than in the song.
 */
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      order: [...UNIT_IDS],
      hidden: [],

      moveUnit: (id, target) => set((s) => ({ order: moveWithin(s.order, id, target) })),
      nudgeUnit: (id, direction) =>
        set((s) => {
          const from = s.order.indexOf(id)
          const to = from + direction
          if (from < 0 || to < 0 || to >= s.order.length) return s
          const next = [...s.order]
          next.splice(from, 1)
          next.splice(to, 0, id)
          return { order: next }
        }),
      hideUnit: (id) =>
        set((s) =>
          FIXED_UNITS.includes(id) || s.hidden.includes(id) ? s : { hidden: [...s.hidden, id] },
        ),
      showUnit: (id) => set((s) => ({ hidden: s.hidden.filter((x) => x !== id) })),
    }),
    {
      name: "rack-layout",
      version: 1,
      // Units added in later versions must still appear: append anything the saved order lacks.
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LayoutState> | undefined) ?? {}
        const order = [...(saved.order ?? []).filter((id): id is UnitId => UNIT_IDS.includes(id))]
        for (const id of UNIT_IDS) if (!order.includes(id)) order.push(id)
        const hidden = (saved.hidden ?? []).filter(
          (id): id is UnitId => UNIT_IDS.includes(id) && !FIXED_UNITS.includes(id),
        )
        return { ...current, order, hidden }
      },
    },
  ),
)
