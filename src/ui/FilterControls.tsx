import { chakra, HStack, NativeSelect } from "@chakra-ui/react"
import { useMemo } from "react"

import {
  FILTER_DEFAULT,
  FILTER_RANGES,
  FILTER_TYPES,
  type FilterParams,
  type FilterType,
} from "../state/params"
import { formatHz, formatQ } from "./format"
import { ControlGroup } from "./ControlGroup"
import { curveX, FILTER_LABELS, filterCurve } from "./filterCurve"
import { Knob } from "./Knob"
import { changeFilter } from "./unitMeta"

const isFilterType = (v: string): v is FilterType => FILTER_TYPES.includes(v as FilterType)

const CURVE_W = 160
const CURVE_H = 56
const CURVE_POINTS = 64
/** dB range drawn, top to bottom. */
const DB_TOP = 24
const DB_BOTTOM = -48

/** The filter's response as a small amber trace on a dark window, the cutoff marked. */
function FilterCurve({
  type,
  cutoff,
  q,
  label,
}: {
  type: FilterType
  cutoff: number
  q: number
  label: string
}) {
  const path = useMemo(() => {
    const gains = filterCurve(type, cutoff, q, CURVE_POINTS)
    const y = (db: number) =>
      ((DB_TOP - Math.max(DB_BOTTOM, Math.min(DB_TOP, db))) / (DB_TOP - DB_BOTTOM)) * CURVE_H
    return gains
      .map(
        (db, i) =>
          `${i === 0 ? "M" : "L"}${((i / (CURVE_POINTS - 1)) * CURVE_W).toFixed(1)} ${y(db).toFixed(1)}`,
      )
      .join(" ")
  }, [type, cutoff, q])
  const zero = (DB_TOP / (DB_TOP - DB_BOTTOM)) * CURVE_H
  const cutoffX = curveX(cutoff) * CURVE_W

  return (
    <chakra.svg
      viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
      w="40"
      h="14"
      rounded="sm"
      bg="rack.display.bg"
      borderWidth="1px"
      borderColor="rack.panel.divider"
      role="img"
      aria-label={label}
    >
      {/* Octave grid and the 0 dB line */}
      <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="1">
        {[100, 1000, 10000].map((hz) => (
          <line key={hz} x1={curveX(hz) * CURVE_W} x2={curveX(hz) * CURVE_W} y1="0" y2={CURVE_H} />
        ))}
        <line x1="0" x2={CURVE_W} y1={zero} y2={zero} />
      </g>
      <chakra.line
        x1={cutoffX}
        x2={cutoffX}
        y1="0"
        y2={CURVE_H}
        stroke="rack.display.dim"
        strokeWidth="1"
      />
      <chakra.path
        d={path}
        fill="none"
        stroke="rack.display.fg"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </chakra.svg>
  )
}

/**
 * The filter's type as a dropdown, over its response curve — the same block on
 * every synth that has a filter. Cutoff and resonance stay knobs beside it.
 */
export function FilterControls({
  type,
  cutoff,
  q,
  onTypeChange,
  heading = true,
}: {
  type: FilterType
  cutoff: number
  q: number
  onTypeChange: (type: FilterType) => void
  /** Print the "Filter" label above; off when a card around it already carries the title. */
  heading?: boolean
}) {
  return (
    <ControlGroup title={heading ? "Filter" : undefined}>
      <NativeSelect.Root size="sm" w="40">
        <NativeSelect.Field
          aria-label="Filter type"
          value={type}
          onChange={(e) => {
            if (isFilterType(e.target.value)) onTypeChange(e.target.value)
          }}
        >
          {FILTER_TYPES.map((t) => (
            <option key={t} value={t}>
              {FILTER_LABELS[t]}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <FilterCurve
        type={type}
        cutoff={cutoff}
        q={q}
        label={`${FILTER_LABELS[type]} response at ${Math.round(cutoff)} Hz`}
      />
    </ControlGroup>
  )
}

/**
 * The whole filter of a machine whose filter sits on its strip (kits, sampler,
 * EP-1, STR-6): type and curve, then cutoff and resonance knobs — the same
 * controls a synth shows, wired to `changeFilter`.
 */
export function StripFilterControls({ id, filter }: { id: string; filter: FilterParams }) {
  return (
    <HStack gap="6" wrap="wrap" align="flex-start">
      <FilterControls
        type={filter.type}
        cutoff={filter.cutoff}
        q={filter.resonance}
        onTypeChange={(type) => changeFilter(id, { type })}
      />
      <HStack gap="4" wrap="wrap" align="flex-start">
        <Knob
          label="Cutoff"
          scale="log"
          value={filter.cutoff}
          min={FILTER_RANGES.cutoff.min}
          max={FILTER_RANGES.cutoff.max}
          step={1}
          defaultValue={FILTER_DEFAULT.cutoff}
          format={formatHz}
          onChange={(cutoff) => changeFilter(id, { cutoff })}
        />
        <Knob
          label="Res"
          value={filter.resonance}
          min={FILTER_RANGES.resonance.min}
          max={FILTER_RANGES.resonance.max}
          step={0.1}
          defaultValue={FILTER_DEFAULT.resonance}
          format={formatQ}
          onChange={(resonance) => changeFilter(id, { resonance })}
        />
      </HStack>
    </HStack>
  )
}
