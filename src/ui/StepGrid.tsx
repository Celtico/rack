import { chakra, useSlotRecipe, type SystemStyleObject } from "@chakra-ui/react"
import {
  memo,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type MouseEvent,
} from "react"

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
      data-row={rowId}
      data-step={step}
      style={COLUMN_STYLE[step]}
      onClick={() => onToggle(rowId as never, step)}
    />
  )
})

interface Cell {
  row: string
  step: number
  on: boolean
}

/** A cell button (or anything inside one) and its state, read off the button itself. */
function cellOf(target: EventTarget | null): Cell | null {
  const el = target instanceof Element ? target.closest<HTMLElement>("[data-step]") : null
  if (!el?.dataset.row || el.dataset.step === undefined) return null
  return {
    row: el.dataset.row,
    step: Number(el.dataset.step),
    on: el.getAttribute("aria-pressed") === "true",
  }
}

/** The cell under a point on screen (jsdom has no hit-testing: then nothing). */
function cellAt(x: number, y: number): Cell | null {
  if (typeof document.elementFromPoint !== "function") return null
  return cellOf(document.elementFromPoint(x, y))
}

/**
 * One toggle button per (row, step). The viewport scrolls horizontally on
 * narrow screens; row labels stay pinned. Accents mark the first step of each
 * beat and the playhead follows the store's `currentStep` — read here, so the
 * unit around the grid does not re-render on every step.
 *
 * A mouse (or pen) paints: press on a cell and drag, and every cell passed
 * over takes the state the first one was given. Fingers keep scrolling the
 * page and the grid instead, and toggle with a tap.
 */
export function StepGrid<Id extends string>({ rows, onToggle }: StepGridProps<Id>) {
  const recipe = useSlotRecipe({ key: "stepGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  const currentStep = useRackStore((s) => s.currentStep)

  // The stroke in progress: the state being painted and the cells already done.
  const stroke = useRef<{ to: boolean; done: Set<string> } | null>(null)
  const toggle = (row: string, step: number) => onToggle(row as Id, step)

  // Whether the press in progress was handled here (mouse/pen), so its click must be dropped.
  const pressed = useRef(false)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pressed.current = false
    if (e.pointerType === "touch" || e.button !== 0) return
    const cell = cellOf(e.target)
    if (!cell) return
    pressed.current = true
    stroke.current = { to: !cell.on, done: new Set([`${cell.row}:${cell.step}`]) }
    toggle(cell.row, cell.step)
    // Keep the moves coming when the drag leaves the grid (jsdom has no capture).
    if (typeof e.currentTarget.setPointerCapture === "function")
      e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current
    if (!s) return
    const cell = cellAt(e.clientX, e.clientY)
    if (!cell) return
    const key = `${cell.row}:${cell.step}`
    if (s.done.has(key)) return
    s.done.add(key)
    if (cell.on !== s.to) toggle(cell.row, cell.step)
  }
  const endStroke = () => {
    stroke.current = null
  }
  // A mouse press already toggled the cell; the click that follows it must not toggle it back.
  // A finger's tap and keyboard activation never set `pressed`, so their click reaches the cell.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!pressed.current) return
    pressed.current = false
    if (cellOf(e.target)) e.stopPropagation()
  }

  return (
    <chakra.div css={styles.root}>
      <chakra.div
        css={styles.grid}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onClickCapture={onClickCapture}
      >
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
