import { chakra, useSlotRecipe } from "@chakra-ui/react"
import { memo, useEffect, useMemo, useRef } from "react"

import {
  BASS_NOTES,
  isMutedIn,
  KIT_VOICES,
  POLY_NOTES,
  rowsOf,
  STEP_COUNT,
  SYNTH_NOTES,
  type Track,
} from "../state/pattern"
import { silencedBySolo, useRackStore, type RackState } from "../state/store"

/** One boolean row per line of the thumbnail, top row first. */
function rowsFor(track: Track): boolean[][] {
  switch (track.kind) {
    case "drums":
    case "perc":
    case "sampler":
    case "video":
    case "mic": {
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

/** Cell, gap and padding sizes of the recipe, in px — the playhead is placed by arithmetic on them. */
const CELL = 3
const CELL_GAP = 2
const BEAT_GAP = 4
const PAD = 4
const BEAT_WIDTH = 4 * CELL + 3 * CELL_GAP
const playheadLeft = (step: number) =>
  PAD + Math.floor(step / 4) * (BEAT_WIDTH + BEAT_GAP) + (step % 4) * (CELL + CELL_GAP)

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

/**
 * A translucent bar over the sounding column — the only thing that moves, and
 * it moves on the DOM: React mounts it when the clock runs and a store
 * subscription sets its column, so a step costs no render for any folded unit.
 */
function MiniPlayhead({ styles }: { styles: Styles }) {
  const running = useRackStore((s) => s.currentStep >= 0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let shown = -1
    const move = (currentStep: number) => {
      if (currentStep < 0) return
      const step = currentStep % STEP_COUNT
      if (step === shown) return
      shown = step
      el.dataset.step = String(step)
      el.style.left = `${playheadLeft(step)}px`
    }
    move(useRackStore.getState().currentStep)
    return useRackStore.subscribe((s) => move(s.currentStep))
  }, [running])
  if (!running) return null
  return <chakra.span ref={ref} css={styles.playhead} data-step="" aria-hidden="true" />
}

/** The slot being heard: the one the song is playing, or the one on screen when stopped. */
const selectSoundingPattern = (s: RackState) =>
  s.patterns[s.playingPattern >= 0 ? s.playingPattern : s.activePattern] ?? s.patterns[0]

/** The track being heard. */
const selectSoundingTrack = (s: RackState, id: string) => selectSoundingPattern(s)?.tracks[id]

/** Nothing of this machine is heard right now: it sits this slot out, is muted, or another one is soloed. */
const selectSilent = (s: RackState, id: string): boolean => {
  const pattern = selectSoundingPattern(s)
  return (
    (pattern !== undefined && isMutedIn(pattern, id)) ||
    s.instances.find((i) => i.id === id)?.mute === true ||
    silencedBySolo(s.solo, id)
  )
}

/** The pattern an instance is playing, in miniature with the playhead — for a folded unit's header. */
export function MiniGrid({ id, label }: { id: string; label: string }) {
  const track = useRackStore((s) => selectSoundingTrack(s, id))
  const silent = useRackStore((s) => selectSilent(s, id))
  const recipe = useSlotRecipe({ key: "miniGrid" })
  const styles = useMemo(() => recipe(), [recipe])
  // A silent machine shows a dark matrix: what it would play is not what is heard.
  const rows = useMemo(
    () => (track ? rowsFor(track).map((row) => (silent ? row.map(() => false) : row)) : []),
    [track, silent],
  )
  if (!track) return null

  return (
    <chakra.div css={styles.root} role="img" aria-label={`${label} pattern`}>
      <MiniCells rows={rows} styles={styles} />
      <MiniPlayhead styles={styles} />
    </chakra.div>
  )
}
