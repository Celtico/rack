import { createEmptyPattern, createStarterPattern, type Pattern, type TrackOwner } from "./pattern"

export const PATTERN_COUNT = 4
export const MAX_CHAIN = 16

/** Slot 1 carries the starter groove; the rest are empty. */
export function createDefaultBank(instances: readonly TrackOwner[]): Pattern[] {
  return [
    createStarterPattern(instances),
    createEmptyPattern(instances),
    createEmptyPattern(instances),
    createEmptyPattern(instances),
  ]
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
