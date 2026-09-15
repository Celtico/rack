import { chakra, useSlotRecipe, type SystemStyleObject } from "@chakra-ui/react"
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type MouseEvent,
  type ReactNode,
} from "react"

import { STEP_COUNT } from "../state/pattern"
import { useRackStore, type RackState } from "../state/store"

export interface StepGridRow<Id extends string> {
  id: Id
  label: string
  steps: readonly boolean[]
}

export interface StepGridProps<Id extends string> {
  rows: readonly StepGridRow<Id>[]
  onToggle: (row: Id, step: number) => void
  /** What the columns are, for the cells' accessible names: "step" (default) or "pattern". */
  columnName?: string
  /** Which column the store says is sounding; the step by default, a bank slot for the parts matrix. */
  playheadOf?: (s: RackState) => number
  /** A row above the cells, one element per column on the very same tracks — the bank's slot buttons. */
  header?: (step: number) => ReactNode
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
  onToggle: (row: never, step: number) => void
  columnName: string
}

/**
 * One toggle button. Memoised, and the playhead is not a prop: the grid
 * lights the sounding column on the DOM itself (`data-playing`), so a step
 * costs no React render at all.
 */
const StepCell = memo(function StepCell({
  css,
  rowId,
  label,
  step,
  on,
  onToggle,
  columnName,
}: StepCellProps) {
  return (
    <chakra.button
      type="button"
      css={css}
      aria-label={`${label} ${columnName} ${step + 1}`}
      aria-pressed={on}
      data-accent={step % 4 === 0 ? "" : undefined}
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
 * beat and the playhead follows the store's `currentStep` — not through
 * React: a store subscription flips `data-playing` on the cells of the old
 * and the new column, the way the meters light their segments. Every grid
 * re-rendering on every sixteenth was the biggest cost of a playing rack
 * (a full commit of ~70 ms on a laptop, worse on a phone).
 *
 * A mouse (or pen) paints: press on a cell and drag, and every cell passed
 * over takes the state the first one was given. Fingers keep scrolling the
 * page and the grid instead, and toggle with a tap.
 */
const stepPlayhead = (s: RackState) => s.currentStep

export function StepGrid<Id extends string>({
  rows,
  onToggle,
  columnName = "step",
  playheadOf = stepPlayhead,
  header,
}: StepGridProps<Id>) {
  const recipe = useSlotRecipe({ key: "stepGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  const gridRef = useRef<HTMLDivElement>(null)

  // Units pass a fresh `onToggle` closure every render; the cells get one stable function instead,
  // so a bar change (the whole unit re-renders) re-renders only the cells whose state differs.
  const onToggleRef = useRef(onToggle)
  useEffect(() => {
    onToggleRef.current = onToggle
  })
  const toggleCell = useCallback((row: never, step: number) => onToggleRef.current(row, step), [])

  // The playhead, on the DOM: light the cells of the sounding column, unlight the previous one.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    let lit = -1
    const light = (step: number) => {
      if (step === lit) return
      if (lit >= 0)
        for (const cell of grid.querySelectorAll(`[data-step="${lit}"]`))
          cell.removeAttribute("data-playing")
      if (step >= 0)
        for (const cell of grid.querySelectorAll(`[data-step="${step}"]`))
          cell.setAttribute("data-playing", "")
      lit = step
    }
    light(playheadOf(useRackStore.getState()))
    return useRackStore.subscribe((s) => light(playheadOf(s)))
  }, [playheadOf])

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
    // Everything painted until the pointer lifts undoes as one step.
    useRackStore.getState().beginStroke()
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
    if (!stroke.current) return
    stroke.current = null
    useRackStore.getState().endStroke()
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
        ref={gridRef}
        css={styles.grid}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onClickCapture={onClickCapture}
      >
        {header && (
          <chakra.div css={styles.row} role="presentation">
            <chakra.span css={styles.label} aria-hidden="true" />
            {STEPS.map((step) => (
              <chakra.div key={step} style={COLUMN_STYLE[step]} display="flex" minW="0">
                {header(step)}
              </chakra.div>
            ))}
          </chakra.div>
        )}
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
                onToggle={toggleCell}
                columnName={columnName}
              />
            ))}
          </chakra.div>
        ))}
      </chakra.div>
    </chakra.div>
  )
}
