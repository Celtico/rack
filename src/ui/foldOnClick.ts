import type { MouseEvent } from "react"

/**
 * Click handler for a header whose whole surface folds: fires `toggle` unless
 * the click landed on a control of its own (the mute button, the grip, the
 * fold button itself — which toggles on its own and would cancel out).
 */
export const foldOnClick = (toggle: () => void) => (e: MouseEvent<HTMLElement>) => {
  const target = e.target as HTMLElement
  if (target.closest("button, a, input, [role=slider], [role=menu]")) return
  toggle()
}
