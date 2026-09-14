/** Sleeves side by side, as many as fit, wrapping. Shared by the Songs panel and the demo shelf. */
export const COVER_GRID = {
  templateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
  gap: "3",
  rowGap: "4",
  listStyleType: "none",
  pt: "2",
  // Room before the hairline under the grid: the same as under every other section.
  pb: "3",
} as const

/** "16 bars", "1 bar", or "loop" for a song with no chain. */
export const songLength = (bars: number) => (bars ? `${bars} bar${bars === 1 ? "" : "s"}` : "loop")
