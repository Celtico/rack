/** Anything the scheduler can fire. `time` is the transport's audio-clock time. */
export interface Voice {
  trigger: (time: number) => void
}
