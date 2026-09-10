import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Units that are not machines and take part in the reorderable stack. The top
 * panel (transport, bank, song) is not one of them: it sits above the stack.
 */
export const FIXED_UNITS = ["FX-2"] as const
export type FixedUnitId = (typeof FIXED_UNITS)[number]

/** Fixed units that can be taken out of view (instances are removed instead). */
export const HIDEABLE_UNITS: readonly FixedUnitId[] = ["FX-2"]

export const isFixedUnit = (id: string): id is FixedUnitId =>
  (FIXED_UNITS as readonly string[]).includes(id)

export interface LayoutState {
  /** Visible order of unit ids — fixed units and instance ids mixed. */
  order: readonly string[]
  /** Fixed units taken out of view. */
  hidden: readonly FixedUnitId[]

  /** Put `id` where `target` is; `target` shifts to make room. */
  moveUnit: (id: string, target: string) => void
  /** Move one place up or down. */
  nudgeUnit: (id: string, direction: -1 | 1) => void
  hideUnit: (id: string) => void
  showUnit: (id: string) => void
  /** Make sure every id is in the order (appended) and nothing else is. */
  syncUnits: (ids: readonly string[]) => void
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

/** `order` restricted to `ids`, with any id it lacks appended in `ids` order. Pure. */
export function ensureOrder(order: readonly string[], ids: readonly string[]): string[] {
  const known = new Set(ids)
  const out = order.filter((id) => known.has(id))
  for (const id of ids) if (!out.includes(id)) out.push(id)
  return out
}

const DEFAULT_ORDER: readonly string[] = ["FX-2"]

/**
 * How the rack is arranged on screen — order and which fixed units are out.
 * UI preference, kept in the browser rather than in the song. Instance ids
 * are appended as instances appear (see `syncUnits`).
 */
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      order: [...DEFAULT_ORDER],
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
          isFixedUnit(id) && HIDEABLE_UNITS.includes(id) && !s.hidden.includes(id)
            ? { hidden: [...s.hidden, id] }
            : s,
        ),
      showUnit: (id) => set((s) => ({ hidden: s.hidden.filter((x) => x !== id) })),
      syncUnits: (ids) =>
        set((s) => {
          const order = ensureOrder(s.order, ids)
          return order.length === s.order.length && order.every((id, i) => id === s.order[i])
            ? s
            : { order }
        }),
    }),
    {
      name: "rack-layout",
      version: 3,
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LayoutState> | undefined) ?? {}
        const order = (saved.order ?? []).filter(
          (id): id is string => typeof id === "string" && (isFixedUnit(id) || id.includes("-")),
        )
        for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id)
        const hidden = (saved.hidden ?? []).filter(
          (id): id is FixedUnitId => isFixedUnit(id) && HIDEABLE_UNITS.includes(id),
        )
        return { ...current, order, hidden }
      },
    },
  ),
)
