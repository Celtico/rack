import { createEmptyPattern, createStarterPattern, type Pattern, type TrackOwner } from "./pattern"

export const PATTERN_COUNT = 16
/** Bars a song can hold. Room for a full arrangement (a pop structure is 120) and then some; the timeline wraps into rows. */
export const MAX_CHAIN = 256

/** Does a loop of `bars` bars start over at this bar? Every `bars` bars, from the first. Pure. */
export const restartsAt = (bar: number, bars: number): boolean => bar % Math.max(1, bars) === 0

/** Slot 1 carries the starter groove; the rest are empty. */
export function createDefaultBank(instances: readonly TrackOwner[]): Pattern[] {
  return [
    createStarterPattern(instances),
    ...Array.from({ length: PATTERN_COUNT - 1 }, () => createEmptyPattern(instances)),
  ]
}

/** `patterns` topped up with empty slots to PATTERN_COUNT — files from a 4-slot bank still load. */
export function padBank(patterns: readonly Pattern[], instances: readonly TrackOwner[]): Pattern[] {
  const out = [...patterns]
  while (out.length < PATTERN_COUNT) out.push(createEmptyPattern(instances))
  return out
}

/** Slot `a` where the chain said `b` and the other way round: the song sounds as before a swap. */
export const swapSlots = (chain: readonly number[], a: number, b: number): number[] =>
  chain.map((s) => (s === a ? b : s === b ? a : s))

/**
 * The bar at `from` taken out and put back at `to` — the place it lands in the new chain, so
 * dragging a bar onto a later one lands after it and onto an earlier one before it. Pure; out-of-range
 * indices leave the chain as it is.
 */
export function movedBar(chain: readonly number[], from: number, to: number): number[] {
  const out = [...chain]
  if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out
  const [bar] = out.splice(from, 1)
  out.splice(to, 0, bar!)
  return out
}

export interface PlayingPattern {
  /** Bank slot, 0-based. */
  index: number
  pattern: Pattern
}

/**
 * Which pattern sounds in a given bar. With a chain, bars walk through it and
 * wrap; without one, the active pattern loops. Pure, so the scheduler stays
 * testable.
 */
export function resolvePlayingPattern(
  patterns: readonly Pattern[],
  activePattern: number,
  chain: readonly number[],
  bar: number,
): PlayingPattern {
  const index = chain.length > 0 ? (chain[bar % chain.length] ?? activePattern) : activePattern
  const pattern = patterns[index] ?? patterns[0]
  if (!pattern) throw new Error("resolvePlayingPattern: empty bank")
  return { index, pattern }
}
