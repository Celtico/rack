/**
 * The buttons of the bar above the rack: small and right-aligned on a desktop,
 * a full-width strip of panel grey on a phone, every button the same height.
 */
export const toolbarButton = {
  size: "xs",
  variant: "subtle",
  rounded: { base: "none", md: "sm" },
  flex: { base: "1 1 0", md: "0 0 auto" },
  minH: { base: "11", md: "auto" },
  bg: { base: "rack.panel", md: undefined },
  color: { base: "rack.silkscreen", md: undefined },
} as const

/** Same strip, but only as wide as its icon. */
export const toolbarIconButton = {
  ...toolbarButton,
  flex: { base: "0 0 auto", md: "0 0 auto" },
  minW: { base: "11", md: "auto" },
} as const
