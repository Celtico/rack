import * as Tone from "tone"

import type { VideoParams } from "../../state/params"
import type { Kit, ModHooks, Voice } from "../types"

/** Ramp length for automatable parameter changes. */
const RAMP = 0.03
/** The gate opens and closes with a short fade, so a chopped loop never clicks. */
const GATE_FADE = 0.004
/** How much of the cutoff a fully lit frame adds, and a dark one takes, at full amount. */
const BRIGHTNESS_SWING = 0.9

/**
 * VID-1: the soundtrack of a video loop, played by an HTMLMediaElement the UI
 * owns and fed into the rack through `attach()` — the only thing here that
 * touches a DOM object, and only to make it a node of this context. The
 * sound runs source → gate → filter → output. The gate is a kit with one
 * voice on the grid; the scheduler sends its state every step (`gateStep`)
 * and only a change moves it, so the loop can be chopped without a dip
 * between lit steps. The frame's brightness (0–1, set by the UI's sampler) adds to
 * the filter's cutoff by `toCutoff`. Without a video (an offline render, a
 * pad with nothing loaded) it is silent.
 */
export class VideoLoop implements Kit<"gate">, ModHooks {
  private readonly gate: Tone.Gain
  private readonly filter: Tone.Filter
  /** The cutoff as a signal into the filter, so the brightness can sum with it. */
  private readonly cutoff: Tone.Signal<"frequency">
  private readonly brightnessMod: Tone.Signal<"frequency">
  private source: MediaElementAudioSourceNode | null = null
  private params: VideoParams
  private brightness = 0.5
  /** Where the gate was last sent, so only a change moves it — no dip between two lit steps. */
  private open = false

  constructor(output: Tone.ToneAudioNode, p: VideoParams) {
    this.params = p
    this.filter = new Tone.Filter({ type: p.filterType, Q: p.resonance, rolloff: -24 }).connect(
      output,
    )
    this.cutoff = new Tone.Signal({ value: p.cutoff, units: "frequency" })
    this.cutoff.connect(this.filter.frequency)
    this.brightnessMod = new Tone.Signal({ value: 0, units: "frequency" })
    this.brightnessMod.connect(this.filter.frequency)
    this.gate = new Tone.Gain(0).connect(this.filter)
  }

  /**
   * Make the element's audio a node of this graph. A media element can be
   * turned into a source once only, and from then on it is heard through the
   * graph alone; attaching the same element again is a no-op.
   */
  attach(element: HTMLMediaElement): void {
    if (this.source) return
    const raw = this.gate.context.rawContext
    if (!("createMediaElementSource" in raw)) return
    this.source = (raw as AudioContext).createMediaElementSource(element)
    Tone.connect(this.source, this.gate)
  }

  /**
   * The gate at a step: open where the grid is lit, shut where it is not. Only
   * a change is scheduled, so the loop runs unbroken across lit steps and
   * swing cannot leave a gap between them.
   */
  gateStep(open: boolean, time: number): void {
    if (open === this.open) return
    this.open = open
    const gain = this.gate.gain
    gain.cancelScheduledValues(time)
    gain.setValueAtTime(gain.getValueAtTime(time), time)
    gain.linearRampToValueAtTime(open ? 1 : 0, time + GATE_FADE)
  }

  /** The clock stopped at `time`: shut the gate. */
  reset(time: number): void {
    this.gateStep(false, time)
  }

  /** An audition outside the sequence: the gate opens for one sixteenth. */
  voice(_id: "gate"): Voice {
    return {
      trigger: (time) => {
        const step = this.gate.toSeconds("16n")
        this.gateStep(true, time)
        this.gateStep(false, time + step)
      },
    }
  }

  /** The gate has no level of its own; the strip's fader is the level. */
  setLevel(_id: "gate", _level: number): void {}

  /** The lit fraction of the current frame, 0–1; moves the cutoff by `toCutoff`. */
  setBrightness(value: number): void {
    this.brightness = value
    this.applyBrightness()
  }

  private applyBrightness(): void {
    const swing = this.params.toCutoff * BRIGHTNESS_SWING * this.params.cutoff
    this.brightnessMod.rampTo((this.brightness * 2 - 1) * swing, 0.05)
  }

  set<K extends keyof VideoParams>(key: K, value: VideoParams[K]): void {
    this.params = { ...this.params, [key]: value }
    switch (key) {
      case "filterType":
        this.filter.type = value as VideoParams["filterType"]
        break
      case "cutoff":
        this.cutoff.rampTo(value as number, RAMP)
        this.applyBrightness()
        break
      case "resonance":
        this.filter.Q.rampTo(value as number, RAMP)
        break
      case "toCutoff":
        this.applyBrightness()
        break
    }
  }

  /** No notes to tune. */
  setTune(_semitones: number): void {}

  cutoffInput(): Tone.Signal<"frequency"> {
    return this.filter.frequency
  }

  pitchInputs(): Tone.Signal<"cents">[] {
    return []
  }

  dispose(): void {
    this.source?.disconnect()
    this.source = null
    this.gate.dispose()
    this.brightnessMod.dispose()
    this.cutoff.dispose()
    this.filter.dispose()
  }
}
