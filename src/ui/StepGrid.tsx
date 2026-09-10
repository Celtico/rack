import { chakra, useSlotRecipe } from "@chakra-ui/react"

import { STEP_COUNT } from "../state/pattern"

export interface StepGridRow<Id extends string> {
  id: Id
  label: string
  steps: readonly boolean[]
}

export interface StepGridProps<Id extends string> {
  rows: readonly StepGridRow<Id>[]
  /** Column currently sounding, or -1. */
  currentStep: number
  onToggle: (row: Id, step: number) => void
}

const STEPS = Array.from({ length: STEP_COUNT }, (_, i) => i)

/**
 * Grid column of a step: column 1 is the label and a gutter track follows
 * every beat of four, so cells skip one column per beat boundary passed.
 */
const columnOf = (step: number) => 2 + step + Math.floor(step / 4)

/**
 * One toggle button per (row, step). The viewport scrolls horizontally on
 * narrow screens; row labels stay pinned. Accents mark the first step of each
 * beat and the playhead follows `currentStep`.
 */
export function StepGrid<Id extends string>({ rows, currentStep, onToggle }: StepGridProps<Id>) {
  const recipe = useSlotRecipe({ key: "stepGrid" })
  const styles = recipe()

  return (
    <chakra.div css={styles.root}>
      <chakra.div css={styles.grid}>
        {rows.map((row) => (
          <chakra.div key={row.id} css={styles.row} role="group" aria-label={row.label}>
            <chakra.span css={styles.label}>{row.label}</chakra.span>
            {STEPS.map((step) => (
              <chakra.button
                key={step}
                type="button"
                css={styles.step}
                aria-label={`${row.label} step ${step + 1}`}
                aria-pressed={row.steps[step] === true}
                data-accent={step % 4 === 0 ? "" : undefined}
                data-playing={step === currentStep ? "" : undefined}
                style={{ gridColumn: columnOf(step) }}
                onClick={() => onToggle(row.id, step)}
              />
            ))}
          </chakra.div>
        ))}
      </chakra.div>
    </chakra.div>
  )
}
