import { chakra, useRecipe, type HTMLChakraProps, type RecipeVariantProps } from "@chakra-ui/react"

import type { displayRecipe } from "../theme/recipes/display"

type DisplayVariants = RecipeVariantProps<typeof displayRecipe>

export interface DisplayProps extends HTMLChakraProps<"output">, DisplayVariants {}

/** Amber readout. Renders an `<output>` so screen readers announce changes. */
export function Display({ size, ...rest }: DisplayProps) {
  const recipe = useRecipe({ key: "display" })
  const styles = recipe({ size })
  return <chakra.output css={styles} {...rest} />
}
