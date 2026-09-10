import { chakra, useSlotRecipe, type RecipeVariantProps } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"

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
 * (`subscribeLevels`) and only re-renders when the number of lit segments
 * changes — the engine owns the analysers; this component only reads numbers.
 */
export function LevelMeter({ source, label, size, orientation }: LevelMeterProps) {
  const recipe = useSlotRecipe({ key: "meter" })
  const styles = recipe({ size, orientation })
  const [lit, setLit] = useState(0)
  const last = useRef(0)

  useEffect(
    () =>
      subscribeLevels((levels) => {
        const next = litSegments(levels[source] ?? 0)
        if (next !== last.current) {
          last.current = next
          setLit(next)
        }
      }),
    [source],
  )

  return (
    <chakra.div
      css={styles.root}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={METER_THRESHOLDS_DB.length}
      aria-valuenow={lit}
    >
      {METER_THRESHOLDS_DB.map((_, i) => (
        <chakra.span
          key={i}
          css={styles.segment}
          data-zone={meterZone(i)}
          data-lit={i < lit ? "" : undefined}
        />
      ))}
    </chakra.div>
  )
}
