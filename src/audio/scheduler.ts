import * as Tone from "tone"

import {
  bassEventAt,
  hitsAt,
  isGateKind,
  isMutedIn,
  polyNotesAt,
  STEP_COUNT,
  synthNoteAt,
  type BassStepEvent,
  type Pattern,
} from "../state/pattern"
import type { PlayingPattern } from "../state/patterns"

/** Every (instance, voice) that fires at a step, in instance order. Pure, testable without audio. */
export function hitsForStep(pattern: Pattern, step: number): [id: string, voice: string][] {
  const out: [string, string][] = []
  for (const [id, track] of Object.entries(pattern.tracks)) {
    // A gate (VID-1, MIC-1) is not a hit: it is sent its own state every step.
    if (!("rows" in track) || isGateKind(track.kind) || isMutedIn(pattern, id)) continue
    for (const voice of hitsAt(track, step)) out.push([id, voice])
  }
  return out
}

/** What a silenced bass part receives on every step: a rest. */
const REST: BassStepEvent = { note: null, accent: false, slide: false }

/** At full swing an off-beat sixteenth lands a third late — the triplet feel. */
export const SWING_MAX_FRACTION = 1 / 3

/**
 * How late an off-beat sixteenth (odd step) sounds, in seconds. `swing` is
 * 0–1; even steps are never moved, so the grid stays anchored to the beat.
 */
export function swingOffset(step: number, swing: number, sixteenthSeconds: number): number {
  return step % 2 === 1 ? swing * SWING_MAX_FRACTION * sixteenthSeconds : 0
}

export interface SchedulerDeps {
  /**
   * Called on every tick with the bar number since the transport started —
   * must resolve against *current* state, never a captured pattern.
   */
  getPattern: (bar: number) => PlayingPattern
  /** Swing amount 0–1, read fresh each tick. */
  getSwing: () => number
  /** Length of a sixteenth at the current tempo. */
  sixteenthSeconds: () => number
  /** Sound one voice of a kit instance at the audio-clock time given by the transport callback. */
  trigger: (id: string, voice: string, time: number) => void
  /** Sound a MONO-1 instance. */
  triggerNote: (id: string, note: string, time: number) => void
  /**
   * The note names of a melodic machine's rows, low to high — its key's. Read fresh each tick, like
   * the pattern. Absent (or `undefined` for an id): the kind's fixed rows.
   */
  rowsOf?: (id: string) => readonly string[] | undefined
  /** Drive a BASS-2 instance — every step, rests included, so slides can release. */
  triggerBass: (id: string, event: BassStepEvent, time: number, stepSeconds: number) => void
  /** Sound a chord on a polyphonic instance. Only called when there are notes. */
  triggerPoly: (id: string, notes: string[], time: number) => void
  /**
   * A gate (VID-1, MIC-1) at this step — every step, so it can shut on the first dark one; with
   * the bar and step, so a loop can start over on its bar.
   */
  triggerGate: (id: string, open: boolean, time: number, bar: number, step: number) => void
  /** Before the step's triggers, at the step's (swung) time — the per-step random modulation is rolled here. */
  onTick?: (time: number) => void
  /** UI-side playhead; invoked through Draw so it lands on the matching frame. Absent when nothing watches (offline render). */
  onStep?: (step: number, patternIndex: number, bar: number) => void
}

/**
 * Drives the bank from the transport. A single `Tone.Sequence` over 16
 * sixteenths whose callback resolves the pattern fresh each tick — a
 * closure-captured pattern would play whatever was on screen when the sequence
 * was created. Bars are counted here so a chain can advance on step 0.
 */
export class Scheduler {
  private sequence: Tone.Sequence<number> | null = null
  private bar = -1
  private readonly deps: SchedulerDeps

  constructor(deps: SchedulerDeps) {
    this.deps = deps
  }

  /** Create and arm the sequence once. Runs whenever the transport runs. */
  start(): void {
    if (this.sequence) return
    const steps = Array.from({ length: STEP_COUNT }, (_, i) => i)
    this.sequence = new Tone.Sequence<number>(this.tick, steps, "16n").start(0)
  }

  /** The bar being played (0 before the first tick) — where a loop recording lines itself up from. */
  get currentBar(): number {
    return Math.max(this.bar, 0)
  }

  /** Rewind the bar counter. Call when the transport stops (it rewinds to step 0 itself). */
  reset(): void {
    this.bar = -1
  }

  dispose(): void {
    this.sequence?.dispose()
    this.sequence = null
    this.reset()
  }

  /** One sixteenth. `time` is the only valid moment to schedule sound — plus swing. */
  readonly tick = (time: number, step: number): void => {
    if (step === 0) this.bar++
    const bar = Math.max(this.bar, 0)
    const { index, pattern } = this.deps.getPattern(bar)
    const sixteenth = this.deps.sixteenthSeconds()
    const at = time + swingOffset(step, this.deps.getSwing(), sixteenth)
    this.deps.onTick?.(at)

    for (const [id, track] of Object.entries(pattern.tracks)) {
      // A part sitting this slot out: nothing fires — a bass gets a rest, so a held slide lets go.
      if (isMutedIn(pattern, id)) {
        if (track.kind === "bass") this.deps.triggerBass(id, REST, at, sixteenth)
        if (isGateKind(track.kind)) this.deps.triggerGate(id, false, at, bar, step)
        continue
      }
      switch (track.kind) {
        case "drums":
        case "perc":
        case "sampler":
          for (const voice of hitsAt(track, step)) this.deps.trigger(id, voice, at)
          break
        case "video":
        case "mic":
          this.deps.triggerGate(id, hitsAt(track, step).length > 0, at, bar, step)
          break
        case "synth": {
          const note = synthNoteAt(track.notes, step, this.deps.rowsOf?.(id))
          if (note) this.deps.triggerNote(id, note, at)
          break
        }
        case "bass":
          this.deps.triggerBass(
            id,
            bassEventAt(track.bass, step, this.deps.rowsOf?.(id)),
            at,
            sixteenth,
          )
          break
        case "poly":
        case "ep":
        case "strings": {
          const notes = polyNotesAt(track, step, this.deps.rowsOf?.(id))
          if (notes.length) this.deps.triggerPoly(id, notes, at)
          break
        }
      }
    }
    // The sequence's own context: an offline render must not queue frames on the live Draw.
    const { onStep } = this.deps
    if (onStep) this.sequence?.context.draw.schedule(() => onStep(step, index, bar), at)
  }
}
