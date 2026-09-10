import { chakra, useSlotRecipe } from "@chakra-ui/react"
import { memo, useMemo } from "react"

import {
  BASS_NOTES,
  KIT_VOICES,
  POLY_NOTES,
  rowsOf,
  STEP_COUNT,
  SYNTH_NOTES,
  type Track,
} from "../state/pattern"
import { selectTrack, useRackStore } from "../state/store"

/** One boolean row per line of the thumbnail, top row first. */
function rowsFor(track: Track): boolean[][] {
  switch (track.kind) {
    case "drums":
    case "perc":
    case "sampler": {
      const rows = rowsOf(track)
      return KIT_VOICES[track.kind].map((voice) => [...(rows[voice] ?? [])])
    }
    case "synth":
      return SYNTH_NOTES.map((_, r) => track.notes.map((n) => n === r)).reverse()
    case "bass":
      return BASS_NOTES.map((_, r) => track.bass.notes.map((n) => n === r)).reverse()
    case "poly":
    case "ep":
    case "strings":
      return POLY_NOTES[track.kind].map((_, r) => track.chords.map((c) => c.includes(r))).reverse()
  }
}

const BEATS = [0, 4, 8, 12]

/** Cell and gap sizes of the recipe, in px — the playhead is placed by arithmetic on them. */
const CELL = 4
const CELL_GAP = 2
const BEAT_GAP = 4
const BEAT_WIDTH = 4 * CELL + 3 * CELL_GAP
const playheadLeft = (step: number) =>
  Math.floor(step / 4) * (BEAT_WIDTH + BEAT_GAP) + (step % 4) * (CELL + CELL_GAP)

type Styles = ReturnType<ReturnType<typeof useSlotRecipe>>

/** The dots. Only re-renders when the track itself changes. */
const MiniCells = memo(function MiniCells({ rows, styles }: { rows: boolean[][]; styles: Styles }) {
  return (
    <>
      {rows.map((row, r) => (
        <chakra.div key={r} css={styles.row}>
          {BEATS.map((beat) => (
            <chakra.div key={beat} css={styles.beat}>
              {Array.from({ length: 4 }, (_, i) => {
                const step = beat + i
                return (
                  <chakra.span key={step} css={styles.cell} data-on={row[step] ? "" : undefined} />
                )
              })}
            </chakra.div>
          ))}
        </chakra.div>
      ))}
    </>
  )
})

/** A translucent bar over the sounding column — the only thing that moves. */
function MiniPlayhead({ styles }: { styles: Styles }) {
  const currentStep = useRackStore((s) => s.currentStep)
  if (currentStep < 0) return null
  const step = currentStep % STEP_COUNT
  return (
    <chakra.span
      css={styles.playhead}
      data-step={step}
      style={{ left: `${playheadLeft(step)}px` }}
      aria-hidden="true"
    />
  )
}

/** The pattern of one instance in miniature, playhead included — for a folded unit's header. */
export function MiniGrid({ id, label }: { id: string; label: string }) {
  const track = useRackStore((s) => selectTrack(s, id))
  const recipe = useSlotRecipe({ key: "miniGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  const rows = useMemo(() => (track ? rowsFor(track) : []), [track])
  if (!track) return null

  return (
    <chakra.div css={styles.root} role="img" aria-label={`${label} pattern`}>
      <MiniCells rows={rows} styles={styles} />
      <MiniPlayhead styles={styles} />
    </chakra.div>
  )
}
