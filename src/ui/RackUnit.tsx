import { chakra, useSlotRecipe, type RecipeVariantProps } from "@chakra-ui/react"
import type { ReactNode } from "react"

import type { rackUnitRecipe } from "../theme/recipes/rackUnit"

type RackUnitVariants = RecipeVariantProps<typeof rackUnitRecipe>

export interface RackUnitProps extends RackUnitVariants {
  /** Model name on the silkscreen, e.g. "DR-4". */
  model: string
  /** Short description next to the model, e.g. "Drum machine". */
  title?: string
  children?: ReactNode
}

const CORNERS = ["tl", "tr", "bl", "br"] as const

export function RackUnit({ model, title, units, children }: RackUnitProps) {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe({ units })

  return (
    <chakra.section css={styles.root} aria-label={title ? `${model} ${title}` : model}>
      {CORNERS.map((corner) => (
        <chakra.span key={corner} css={styles.screw} data-corner={corner} aria-hidden="true" />
      ))}
      <chakra.header css={styles.header}>
        <chakra.h2 css={styles.model}>{model}</chakra.h2>
        {title && <chakra.span css={styles.title}>{title}</chakra.span>}
      </chakra.header>
      <chakra.div css={styles.body}>{children}</chakra.div>
    </chakra.section>
  )
}
