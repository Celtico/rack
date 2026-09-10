import { chakra, useSlotRecipe, type SystemStyleObject } from "@chakra-ui/react"
import { memo, useMemo, type CSSProperties } from "react"

import { STEP_COUNT } from "../state/pattern"
import { useRackStore } from "../state/store"

export interface StepGridRow<Id extends string> {
  id: Id
  label: string
  steps: readonly boolean[]
}

export interface StepGridProps<Id extends string> {
  rows: readonly StepGridRow<Id>[]
  onToggle: (row: Id, step: number) => void
}

const STEPS = Array.from({ length: STEP_COUNT }, (_, i) => i)

/**
 * Grid column of a step: column 1 is the label and a gutter track follows
 * every beat of four, so cells skip one column per beat boundary passed.
 */
const columnOf = (step: number) => 2 + step + Math.floor(step / 4)
const COLUMN_STYLE: CSSProperties[] = STEPS.map((step) => ({ gridColumn: columnOf(step) }))

interface StepCellProps {
  css: SystemStyleObject | undefined
  rowId: string
  label: string
  step: number
  on: boolean
  playing: boolean
  onToggle: (row: never, step: number) => void
}

/**
 * One toggle button. Memoised so a moving playhead only re-renders the two
 * cells per row that change — a grid of 128 Chakra buttons is expensive to
 * restyle sixteen times a bar.
 */
const StepCell = memo(function StepCell({
  css,
  rowId,
  label,
  step,
  on,
  playing,
  onToggle,
}: StepCellProps) {
  return (
    <chakra.button
      type="button"
      css={css}
      aria-label={`${label} step ${step + 1}`}
      aria-pressed={on}
      data-accent={step % 4 === 0 ? "" : undefined}
      data-playing={playing ? "" : undefined}
      style={COLUMN_STYLE[step]}
      onClick={() => onToggle(rowId as never, step)}
    />
  )
})

/**
 * One toggle button per (row, step). The viewport scrolls horizontally on
 * narrow screens; row labels stay pinned. Accents mark the first step of each
 * beat and the playhead follows the store's `currentStep` — read here, so the
 * unit around the grid does not re-render on every step.
 */
export function StepGrid<Id extends string>({ rows, onToggle }: StepGridProps<Id>) {
  const recipe = useSlotRecipe({ key: "stepGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  const currentStep = useRackStore((s) => s.currentStep)

  return (
    <chakra.div css={styles.root}>
      <chakra.div css={styles.grid}>
        {rows.map((row) => (
          <chakra.div key={row.id} css={styles.row} role="group" aria-label={row.label}>
            <chakra.span css={styles.label}>{row.label}</chakra.span>
            {STEPS.map((step) => (
              <StepCell
                key={step}
                css={styles.step}
                rowId={row.id}
                label={row.label}
                step={step}
                on={row.steps[step] === true}
                playing={step === currentStep}
                onToggle={onToggle as (row: never, step: number) => void}
              />
            ))}
          </chakra.div>
        ))}
      </chakra.div>
    </chakra.div>
  )
}
