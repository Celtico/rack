import { PATTERN_COUNT } from "../state/patterns"

/** How long a second digit may follow the first and still join it ("1" then "3" → 13). */
export const DIGIT_JOIN_MS = 800

/** The last digit typed on a bar, so the next one can join it. */
export interface TypedDigit {
  bar: number
  value: number
  at: number
}

/**
 * A digit typed on a focused bar picks its pattern by number (1–16): "3" is
 * pattern 3, and a second digit within `DIGIT_JOIN_MS` on the same bar joins
 * the first ("1", "3" → 13; "2", "5" cannot, so 5 stands). Returns the slot
 * index to set and what to remember, or null when the key is not a usable digit.
 */
export function typeSlotDigit(
  pending: TypedDigit | null,
  key: string,
  bar: number,
  now: number,
): { slot: number; pending: TypedDigit } | null {
  if (!/^[0-9]$/.test(key)) return null
  const digit = Number(key)
  const joins = pending !== null && pending.bar === bar && now - pending.at < DIGIT_JOIN_MS
  const joined = joins ? pending.value * 10 + digit : digit
  const value = joined >= 1 && joined <= PATTERN_COUNT ? joined : digit
  if (value < 1 || value > PATTERN_COUNT) return null
  return { slot: value - 1, pending: { bar, value, at: now } }
}
