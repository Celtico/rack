/** Segment thresholds in dB, bottom to top: 6 dB apart, top segment at 0 dBFS. */
export const METER_THRESHOLDS_DB = [-42, -36, -30, -24, -18, -12, -6, 0] as const

export const meterZone = (i: number) => (i >= 7 ? "red" : i >= 5 ? "yellow" : "green")

/** How many segments a linear 0–1 level lights. Pure. */
export function litSegments(level: number): number {
  if (level <= 0) return 0
  const db = 20 * Math.log10(level)
  let lit = 0
  for (const t of METER_THRESHOLDS_DB) if (db >= t) lit++
  return lit
}
