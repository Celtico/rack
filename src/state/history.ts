/**
 * An undo/redo history of snapshots. Pure: the store keeps one and hands it
 * the snapshot to remember before each edit. Snapshots are cheap — the state
 * is immutable, so an entry is a handful of references.
 */

/** Steps kept; the oldest fall off. */
export const HISTORY_LIMIT = 100
/** Edits with the same key this close together are one step (a knob turn, a fader drag). */
export const COALESCE_MS = 300

export interface Entry<S> {
  /** The state before the edit. */
  snap: S
  /** What kind of edit followed, for coalescing; null never coalesces. */
  key: string | null
  at: number
}

export interface History<S> {
  readonly past: readonly Entry<S>[]
  readonly future: readonly S[]
}

export const emptyHistory = <S>(): History<S> => ({ past: [], future: [] })

/**
 * Remember `snap` as the state before an edit of kind `key` made at `now`. Any
 * redo is forgotten. Edits of the same kind within `window` ms are one step —
 * `Infinity` for a stroke that lasts as long as the pointer is down.
 */
export function record<S>(
  h: History<S>,
  snap: S,
  key: string | null,
  now: number,
  window = COALESCE_MS,
): History<S> {
  const last = h.past[h.past.length - 1]
  if (last && key !== null && last.key === key && now - last.at < window) {
    // Same knob, still turning: the step's "before" stays the first snapshot; the clock moves on.
    return { past: [...h.past.slice(0, -1), { ...last, at: now }], future: [] }
  }
  const past = [...h.past, { snap, key, at: now }]
  return { past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past, future: [] }
}

/** Step back: the snapshot to restore, with `current` kept for a redo. Null when there is nothing. */
export function undo<S>(h: History<S>, current: S): { history: History<S>; snap: S } | null {
  const last = h.past[h.past.length - 1]
  if (!last) return null
  return { history: { past: h.past.slice(0, -1), future: [...h.future, current] }, snap: last.snap }
}

/** Step forward again: the snapshot to restore, with `current` back on the past. Null when there is nothing. */
export function redo<S>(
  h: History<S>,
  current: S,
  now: number,
): { history: History<S>; snap: S } | null {
  const next = h.future[h.future.length - 1]
  if (next === undefined) return null
  return {
    history: {
      past: [...h.past, { snap: current, key: null, at: now }],
      future: h.future.slice(0, -1),
    },
    snap: next,
  }
}
