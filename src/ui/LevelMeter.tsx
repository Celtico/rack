import { chakra, useSlotRecipe, type RecipeVariantProps } from "@chakra-ui/react"
import { useEffect, useRef } from "react"

import type { LevelSource } from "../audio/engine"
import type { meterRecipe } from "../theme/recipes/meter"
import { subscribeLevels } from "./levels"
import { litSegments, METER_THRESHOLDS_DB, meterZone } from "./meterScale"

type MeterVariants = RecipeVariantProps<typeof meterRecipe>

export interface LevelMeterProps extends MeterVariants {
  source: LevelSource
  label: string
}

/**
 * An LED meter that follows one engine source through the shared levels loop
 * (`subscribeLevels`). The segments are lit by flipping `data-lit` on the DOM
 * directly from that loop — a meter bounces up to 30 times a second, and a
 * React render (nine styled elements) each time was the rack's biggest
 * running cost on a phone. React draws the meter once; the loop only touches
 * attributes.
 */
export function LevelMeter({ source, label, size, orientation }: LevelMeterProps) {
  const recipe = useSlotRecipe({ key: "meter" })
  const styles = recipe({ size, orientation })
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let last = -1
    return subscribeLevels(source, (level) => {
      const next = litSegments(level)
      const el = root.current
      if (next === last || !el) return
      last = next
      el.setAttribute("aria-valuenow", String(next))
      const segments = el.children
      for (let i = 0; i < segments.length; i++) {
        if (i < next) segments[i]!.setAttribute("data-lit", "")
        else segments[i]!.removeAttribute("data-lit")
      }
    })
  }, [source])

  return (
    <chakra.div
      ref={root}
      css={styles.root}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={METER_THRESHOLDS_DB.length}
      aria-valuenow={0}
    >
      {METER_THRESHOLDS_DB.map((_, i) => (
        <chakra.span key={i} css={styles.segment} data-zone={meterZone(i)} />
      ))}
    </chakra.div>
  )
}
