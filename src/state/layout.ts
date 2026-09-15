import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Units that are not machines and take part in the reorderable stack. The top
 * panel (transport, bank, song) is not one of them: it sits above the stack.
 */
export const FIXED_UNITS = ["FX-2"] as const
export type FixedUnitId = (typeof FIXED_UNITS)[number]

export const isFixedUnit = (id: string): id is FixedUnitId =>
  (FIXED_UNITS as readonly string[]).includes(id)

/** The panels stuck under the transport: they swap places with each other, never with the stack. */
export const PINNED_UNITS = ["PATTERN", "SONG"] as const
export type PinnedUnitId = (typeof PINNED_UNITS)[number]

export const isPinnedUnit = (id: string): id is PinnedUnitId =>
  (PINNED_UNITS as readonly string[]).includes(id)

/** The transport: never moved, but it can leave and come back like the rest. */
export const TRANSPORT_UNIT = "CLOCK"

/** Units that can be taken out of view and put back (instances are removed instead). */
export type HideableUnitId = FixedUnitId | PinnedUnitId | typeof TRANSPORT_UNIT
export const HIDEABLE_UNITS: readonly HideableUnitId[] = [TRANSPORT_UNIT, "FX-2", ...PINNED_UNITS]
export const isHideableUnit = (id: string): id is HideableUnitId =>
  (HIDEABLE_UNITS as readonly string[]).includes(id)

export interface LayoutState {
  /** Visible order of unit ids — fixed units and instance ids mixed. */
  order: readonly string[]
  /** Fixed and pinned units taken out of view. */
  hidden: readonly HideableUnitId[]
  /** Order of the sticky panels under the transport. */
  pinnedOrder: readonly PinnedUnitId[]

  /** Put `id` where `target` is; `target` shifts to make room. */
  moveUnit: (id: string, target: string) => void
  /** Move one place up or down. */
  nudgeUnit: (id: string, direction: -1 | 1) => void
  hideUnit: (id: string) => void
  showUnit: (id: string) => void
  /** Put every hidden panel back — a demo from the empty rack brings the whole rack with it. */
  showAll: () => void
  /** Make sure every id is in the order (appended) and nothing else is. */
  syncUnits: (ids: readonly string[]) => void
  /** Put `id` right under `after` — where a duplicate belongs. Unknown `after`: appended. */
  placeAfter: (id: string, after: string) => void
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

/** One place up or down within `list`, or the list unchanged at either end. Pure. */
function nudgeIn<T>(list: readonly T[], id: T, direction: -1 | 1): T[] | null {
  const from = list.indexOf(id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return null
  const next = [...list]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

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
      pinnedOrder: [...PINNED_UNITS],

      moveUnit: (id, target) =>
        set((s) => {
          // Pinned panels only trade places among themselves; a drop across the two lists is ignored.
          if (isPinnedUnit(id) || isPinnedUnit(target)) {
            return isPinnedUnit(id) && isPinnedUnit(target)
              ? { pinnedOrder: moveWithin(s.pinnedOrder, id, target) }
              : s
          }
          return { order: moveWithin(s.order, id, target) }
        }),
      nudgeUnit: (id, direction) =>
        set((s) => {
          if (isPinnedUnit(id)) {
            const pinnedOrder = nudgeIn(s.pinnedOrder, id, direction)
            return pinnedOrder ? { pinnedOrder } : s
          }
          const order = nudgeIn(s.order, id, direction)
          return order ? { order } : s
        }),
      hideUnit: (id) =>
        set((s) =>
          isHideableUnit(id) && !s.hidden.includes(id) ? { hidden: [...s.hidden, id] } : s,
        ),
      showUnit: (id) => set((s) => ({ hidden: s.hidden.filter((x) => x !== id) })),
      showAll: () => set({ hidden: [] }),
      syncUnits: (ids) =>
        set((s) => {
          const order = ensureOrder(s.order, ids)
          return order.length === s.order.length && order.every((id, i) => id === s.order[i])
            ? s
            : { order }
        }),
      placeAfter: (id, after) =>
        set((s) => {
          if (isPinnedUnit(id)) return s
          const order = s.order.filter((x) => x !== id)
          const at = order.indexOf(after)
          order.splice(at < 0 ? order.length : at + 1, 0, id)
          return { order }
        }),
    }),
    {
      name: "rack-layout",
      version: 3,
      merge: (persisted, current) => {
        // Nothing stored — a first visit: the defaults stand (an empty rack), nothing to reconcile.
        if (!persisted) return current
        const saved = persisted as Partial<LayoutState>
        const order = (saved.order ?? []).filter(
          (id): id is string => typeof id === "string" && (isFixedUnit(id) || id.includes("-")),
        )
        for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id)
        const hidden = (saved.hidden ?? []).filter(isHideableUnit)
        const pinnedOrder = (saved.pinnedOrder ?? []).filter(isPinnedUnit)
        for (const id of PINNED_UNITS) if (!pinnedOrder.includes(id)) pinnedOrder.push(id)
        return { ...current, order, hidden, pinnedOrder }
      },
    },
  ),
)
