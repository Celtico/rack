import { chakra, Text, useRecipe, VStack, type RecipeVariantProps } from "@chakra-ui/react"
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react"

import type { knobRecipe } from "../theme/recipes/knob"

type KnobVariants = RecipeVariantProps<typeof knobRecipe>

export interface KnobProps extends KnobVariants {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /**
   * `log` spreads the travel evenly across octaves — for frequencies. Keyboard
   * moves in travel space on a log knob; on a linear one it moves by `step`.
   */
  scale?: "linear" | "log"
  /** Double-click resets to this value. */
  defaultValue?: number
  /** Text shown under the knob and read by assistive tech. */
  format?: (value: number) => string
  onChange: (value: number) => void
}

/** Degrees of rotation from min to max. */
const SWEEP = 270
/** Vertical pointer travel (px) for a full sweep — a mouse, and a thumb, which has less room. */
const DRAG_PX = 150
const DRAG_PX_TOUCH = 100
/** Keyboard nudge on a log knob, as a fraction of the travel. */
const KEY_TRAVEL = 0.02

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * A hand-built rotary control. Because it is not a native input it owns its own
 * accessibility: `role="slider"`, ARIA value props, keyboard handling and a
 * visible focus ring (from the recipe). Drag is vertical with pointer capture,
 * hold Shift for fine control.
 */
export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  scale = "linear",
  defaultValue,
  format,
  onChange,
  size,
}: KnobProps) {
  const recipe = useRecipe({ key: "knob" })
  const styles = recipe({ size })
  const labelId = useId()
  const drag = useRef<{ y: number; pos: number } | null>(null)
  const [turning, setTurning] = useState(false)

  // Travel ∈ [0, 1] ↔ value.
  const toPos = (v: number) =>
    scale === "log" ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
  const fromPos = (p: number) => (scale === "log" ? min * (max / min) ** p : min + p * (max - min))

  // Round to the step's own precision so 0.1-steps don't accumulate float noise.
  const decimals = (String(step).split(".")[1] ?? "").length
  const quantize = (v: number) =>
    Number((Math.round((v - min) / step) * step + min).toFixed(decimals))

  const commit = (next: number) => {
    const clamped = clamp(quantize(next), min, max)
    if (clamped !== value) onChange(clamped)
  }

  /** Nudge by `direction` — one step on a linear knob, a slice of travel on a log one. */
  const nudge = (direction: number, magnitude = 1) => {
    if (scale === "log") {
      const next = fromPos(clamp(toPos(value) + direction * KEY_TRAVEL * magnitude, 0, 1))
      // Make sure a keypress always moves at least one step, even where log spacing is fine.
      const quantized = clamp(quantize(next), min, max)
      commit(quantized === value ? value + direction * step : quantized)
    } else {
      commit(value + direction * step * magnitude)
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    drag.current = { y: e.clientY, pos: toPos(value) }
    setTurning(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const fine = e.shiftKey ? 0.2 : 1
    const travel = e.pointerType === "touch" ? DRAG_PX_TOUCH : DRAG_PX
    const pos = drag.current.pos + ((drag.current.y - e.clientY) / travel) * fine
    commit(fromPos(clamp(pos, 0, 1)))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    setTurning(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        nudge(1)
        break
      case "ArrowDown":
      case "ArrowLeft":
        nudge(-1)
        break
      case "PageUp":
        nudge(1, 10)
        break
      case "PageDown":
        nudge(-1, 10)
        break
      case "Home":
        commit(min)
        break
      case "End":
        commit(max)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const onDoubleClick = () => {
    if (defaultValue !== undefined) commit(defaultValue)
  }

  const angle = -SWEEP / 2 + toPos(value) * SWEEP
  const text = format ? format(value) : String(value)

  return (
    <VStack gap="1" align="center">
      <chakra.div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        aria-orientation="vertical"
        css={styles}
        style={{ "--knob-angle": `${angle}deg` } as CSSProperties}
        data-active={turning ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
      />
      <Text id={labelId} textStyle="silkscreen" color="rack.silkscreen.muted">
        {label}
      </Text>
    </VStack>
  )
}
