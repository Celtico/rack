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
  minH: { base: "12", md: "auto" },
  fontSize: { base: "md", md: "sm" },
  px: { base: "2", md: "3" },
  "& svg": { fontSize: { base: "xl", md: "md" } },
} as const

/** Same, but only as wide as its icon. */
export const toolbarIconButton = {
  ...toolbarButton,
  flex: "0 0 auto",
  minW: { base: "12", md: "auto" },
  px: { base: "0", md: "3" },
} as const
