import { chakra, useSlotRecipe, type RecipeVariantProps } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"

import { getEngine, type LevelSource } from "../audio/engine"
import type { meterRecipe } from "../theme/recipes/meter"
import { litSegments, METER_THRESHOLDS_DB, meterZone } from "./meterScale"

type MeterVariants = RecipeVariantProps<typeof meterRecipe>

export interface LevelMeterProps extends MeterVariants {
  source: LevelSource
  label: string
}

/**
 * An LED meter that follows one engine source. It polls `engine.getLevels()`
 * on animation frames and only re-renders when the number of lit segments
 * changes — the engine owns the analysers; this component only reads numbers.
 */
export function LevelMeter({ source, label, size }: LevelMeterProps) {
  const recipe = useSlotRecipe({ key: "meter" })
  const styles = recipe({ size })
  const [lit, setLit] = useState(0)
  const last = useRef(0)

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const next = litSegments(getEngine().getLevels()[source] ?? 0)
      if (next !== last.current) {
        last.current = next
        setLit(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [source])

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
