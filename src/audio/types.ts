/** Ramp length for parameter changes — long enough to avoid clicks, short enough to feel direct. */
export const RAMP = 0.03

import * as Tone from "tone"

/** Anything the scheduler can fire. `time` is the transport's audio-clock time. */
export interface Voice {
  trigger: (time: number) => void
}

/**
 * What the strip's modulators can reach inside a melodic device: its filter's
 * frequency (the synths that own a filter) and its voices' detune signals.
 * Tuning is applied by the device itself, note by note.
 */
export interface ModHooks {
  setTune: (semitones: number) => void
  cutoffInput: () => Tone.Signal<"frequency"> | null
  pitchInputs: () => Tone.Signal<"cents">[]
}

/** `note` moved by `semitones` — how every melodic device applies its tuning. */
export const transposeNote = (note: string, semitones: number): string =>
  semitones === 0 ? note : Tone.Frequency(note).transpose(semitones).toNote()

/** A set of one-shot voices with a level each — DR-4, PERC-6. */
export interface Kit<Id extends string> {
  voice: (id: Id) => Voice
  setLevel: (id: Id, level: number) => void
  dispose: () => void
}
