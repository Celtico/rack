/**
 * The buttons of the bar above the rack: small and right-aligned on a desktop,
 * a full-width strip of panel grey on a phone, every button the same height.
 */
export const toolbarButton = {
  size: "sm",
  variant: "subtle",
  rounded: { base: "none", md: "sm" },
  flex: { base: "1 1 0", md: "0 0 auto" },
  // Tall on a phone: a thumb target, on a strip a shade lighter than the panels.
  minH: { base: "16", md: "auto" },
  fontSize: { base: "md", md: "sm" },
  px: { base: "2", md: "3" },
  "& svg": { fontSize: { base: "xl", md: "md" } },
  bg: { base: "rack.toolbar", md: undefined },
  color: { base: "rack.silkscreen", md: undefined },
  _hover: { bg: { base: "rack.step.accent", md: undefined } },
  // A hairline between neighbours on the phone strip, where there is no gap.
  borderInlineStartWidth: { base: "1px", md: "0" },
  borderColor: "rack.panel",
} as const

/** Same strip, but only as wide as its icon. */
export const toolbarIconButton = {
  ...toolbarButton,
  flex: { base: "0 0 auto", md: "0 0 auto" },
  minW: { base: "12", md: "auto" },
  px: { base: "0", md: "3" },
} as const
