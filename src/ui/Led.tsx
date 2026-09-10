import { chakra, useRecipe } from "@chakra-ui/react"

export interface LedProps {
  on: boolean
  label: string
}

export function Led({ on, label }: LedProps) {
  const recipe = useRecipe({ key: "led" })
  const styles = recipe({ on })
  return <chakra.span css={styles} role="img" aria-label={`${label} ${on ? "on" : "off"}`} />
}
