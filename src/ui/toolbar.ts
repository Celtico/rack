/**
 * The buttons of the toolbar panel: small and right-aligned on a desktop; on a
 * phone they share the panel's width and are tall enough for a thumb.
 */
export const toolbarButton = {
  size: "sm",
  // A dark fill, so the three read as buttons on the strip (tried without: the user wants it back).
  variant: "subtle",
  rounded: "sm",
  flex: { base: "1 1 0", md: "0 0 auto" },
  // 36 px tall on a phone — the user asked for smaller twice (they were 48, then 40).
  minH: { base: "9", md: "auto" },
  fontSize: { base: "xs", md: "sm" },
  px: { base: "2", md: "3" },
  "& svg": { fontSize: "md" },
} as const

/** Same, but only as wide as its icon — and with no fill (undo, redo, fold all sit plain on the strip). */
export const toolbarIconButton = {
  ...toolbarButton,
  variant: "ghost",
  flex: "0 0 auto",
  minW: { base: "9", md: "auto" },
  px: { base: "0", md: "3" },
} as const
