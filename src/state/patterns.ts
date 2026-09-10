import { createEmptyPattern, createStarterPattern, type Pattern, type TrackOwner } from "./pattern"

export const PATTERN_COUNT = 16
export const MAX_CHAIN = 16

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
