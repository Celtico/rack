import * as Tone from "tone"

import {
  bassEventAt,
  hitsAt,
  polyNotesAt,
  STEP_COUNT,
  synthNoteAt,
  type BassStepEvent,
  type Pattern,
  type SynthNote,
} from "../state/pattern"
import type { PlayingPattern } from "../state/patterns"

/** Every (instance, voice) that fires at a step, in instance order. Pure, testable without audio. */
export function hitsForStep(pattern: Pattern, step: number): [id: string, voice: string][] {
  const out: [string, string][] = []
  for (const [id, track] of Object.entries(pattern.tracks)) {
    if (!("rows" in track)) continue
    for (const voice of hitsAt(track, step)) out.push([id, voice])
  }
  return out
}

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
  triggerNote: (id: string, note: SynthNote, time: number) => void
  /** Drive a BASS-2 instance — every step, rests included, so slides can release. */
  triggerBass: (id: string, event: BassStepEvent, time: number, stepSeconds: number) => void
  /** Sound a chord on a polyphonic instance. Only called when there are notes. */
  triggerPoly: (id: string, notes: string[], time: number) => void
  /** UI-side playhead; invoked through Draw so it lands on the matching frame. */
  onStep: (step: number, patternIndex: number, bar: number) => void
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

    for (const [id, track] of Object.entries(pattern.tracks)) {
      switch (track.kind) {
        case "drums":
        case "perc":
        case "sampler":
          for (const voice of hitsAt(track, step)) this.deps.trigger(id, voice, at)
          break
        case "synth": {
          const note = synthNoteAt(track.notes, step)
          if (note) this.deps.triggerNote(id, note, at)
          break
        }
        case "bass":
          this.deps.triggerBass(id, bassEventAt(track.bass, step), at, sixteenth)
          break
        case "poly":
        case "ep":
        case "strings": {
          const notes = polyNotesAt(track, step)
          if (notes.length) this.deps.triggerPoly(id, notes, at)
          break
        }
      }
    }
    Tone.getDraw().schedule(() => this.deps.onStep(step, index, bar), at)
  }
}
