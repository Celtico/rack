/** Anything the scheduler can fire. `time` is the transport's audio-clock time. */
export interface Voice {
  trigger: (time: number) => void
}

/** A set of one-shot voices with a level each — DR-4, PERC-6. */
export interface Kit<Id extends string> {
  voice: (id: Id) => Voice
  setLevel: (id: Id, level: number) => void
  dispose: () => void
}
