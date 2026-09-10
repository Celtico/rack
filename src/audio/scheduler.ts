import * as Tone from "tone"

import {
  DRUM_VOICES,
  STEP_COUNT,
  synthNoteAt,
  type DrumVoiceId,
  type Pattern,
  type SynthNote,
} from "../state/pattern"
import type { PlayingPattern } from "../state/patterns"

/** Which drum voices are on at a given step. Pure, so it can be tested without audio. */
export function triggersForStep(pattern: Pattern, step: number): DrumVoiceId[] {
  return DRUM_VOICES.filter((voice) => pattern.drums[voice][step] === true)
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
  /** Sound a drum voice at the audio-clock time given by the transport callback. */
  trigger: (voice: DrumVoiceId, time: number) => void
  /** Sound the mono synth. */
  triggerNote: (note: SynthNote, time: number) => void
  /** UI-side playhead; invoked through Draw so it lands on the matching frame. */
  onStep: (step: number, patternIndex: number) => void
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
    const { index, pattern } = this.deps.getPattern(Math.max(this.bar, 0))
    const at = time + swingOffset(step, this.deps.getSwing(), this.deps.sixteenthSeconds())
    for (const voice of triggersForStep(pattern, step)) {
      this.deps.trigger(voice, at)
    }
    const note = synthNoteAt(pattern, step)
    if (note) this.deps.triggerNote(note, at)
    Tone.getDraw().schedule(() => this.deps.onStep(step, index), at)
  }
}
