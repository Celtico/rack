import * as Tone from "tone"

import { RAMP, type Voice } from "../types"

/** The gate opens and closes with a short fade, so a chopped sound never clicks. */
const GATE_FADE = 0.004

/**
 * The one-row gate of VID-1 and MIC-1: a gain the scheduler sends open or
 * shut every step. Only a change is scheduled, so the sound runs unbroken
 * across lit steps and swing cannot leave a gap between them.
 */
export class StepGate {
  readonly node = new Tone.Gain(0)
  /** Where the gate was last sent, so only a change moves it. */
  private open = false

  step(open: boolean, time: number): void {
    if (open === this.open) return
    this.open = open
    const gain = this.node.gain
    gain.cancelScheduledValues(time)
    gain.setValueAtTime(gain.getValueAtTime(time), time)
    gain.linearRampToValueAtTime(open ? 1 : 0, time + GATE_FADE)
  }

  /** An audition outside the sequence: the gate opens for one sixteenth. */
  voice(): Voice {
    return {
      trigger: (time) => {
        const step = this.node.toSeconds("16n")
        this.step(true, time)
        this.step(false, time + step)
      },
    }
  }

  dispose(): void {
    this.node.dispose()
  }
}

/**
 * The three filter parameters a device with its own `Tone.Filter` and a cutoff
 * signal shares with the others (type set live, cutoff and Q ramped). True when
 * `key` was one of them.
 */
export function setFilterParam(
  filter: Tone.Filter,
  cutoff: Tone.Signal<"frequency">,
  key: string,
  value: unknown,
): boolean {
  switch (key) {
    case "filterType":
      filter.type = value as BiquadFilterType
      return true
    case "cutoff":
      cutoff.rampTo(value as number, RAMP)
      return true
    case "resonance":
      filter.Q.rampTo(value as number, RAMP)
      return true
  }
  return false
}
