import * as Tone from "tone"

import type { MicParams } from "../../state/params"
import { getSample } from "../sampleStore"
import type { Kit, ModHooks, Voice } from "../types"

/** Ramp length for automatable parameter changes. */
const RAMP = 0.03
/** The gate opens and closes with a short fade, so a chopped voice never clicks. */
const GATE_FADE = 0.004
const CAPTURE_PROCESSOR = "rack-capture"

/** Does the loop start over at this bar? Every `bars` bars, from the first. Pure. */
export const restartsAt = (bar: number, bars: number): boolean => bar % Math.max(1, bars) === 0

/**
 * MIC-1: the microphone through the rack. The live input (a `MediaStream` the
 * page asked for, fed in through `attach()`) and a loop recorded from it play
 * side by side: live → liveGain ┐
 *                                ├ gate → filter → output
 *                loop → loopGain ┘
 * The gate is the one-row grid, sent its state every step like VID-1's. The
 * loop is recorded by an AudioWorklet (`capture.worklet.js`) between two exact
 * frames of the clock, so it sits on the bar; it plays back at the tempo it
 * was recorded at, rate-shifted when the clock changes. Without a stream (an
 * offline render) only the loop sounds.
 */
export class MicInput implements Kit<"gate">, ModHooks {
  private readonly gate: Tone.Gain
  private readonly filter: Tone.Filter
  private readonly cutoff: Tone.Signal<"frequency">
  private readonly liveGain: Tone.Gain
  private readonly loopGain: Tone.Gain
  private readonly player: Tone.Player
  private source: MediaStreamAudioSourceNode | null = null
  private capture: AudioWorkletNode | null = null
  private captureSink: Tone.Gain | null = null
  private params: MicParams
  private open = false
  /** Resolves once the take used as the loop (if any) is decoded — an offline render waits for it. */
  readonly ready: Promise<void>

  constructor(output: Tone.ToneAudioNode, p: MicParams) {
    this.params = p
    this.filter = new Tone.Filter({ type: p.filterType, Q: p.resonance, rolloff: -24 }).connect(
      output,
    )
    this.cutoff = new Tone.Signal({ value: p.cutoff, units: "frequency" })
    this.cutoff.connect(this.filter.frequency)
    this.gate = new Tone.Gain(0).connect(this.filter)
    this.liveGain = new Tone.Gain(p.live ? p.liveLevel : 0).connect(this.gate)
    this.loopGain = new Tone.Gain(p.loopLevel).connect(this.gate)
    this.player = new Tone.Player({ loop: true }).connect(this.loopGain)
    this.ready = this.loadTake(p.loopKey)
  }

  /** The take under `key` (null: none) decoded into the player; a missing one leaves it empty. */
  async loadTake(key: string | null): Promise<void> {
    if (key === null) return
    try {
      const stored = await getSample(key)
      if (stored) await this.setLoopBytes(stored.data)
    } catch {
      // A take that will not decode: no loop, the live input still plays.
    }
  }

  /** Make the microphone's stream a node of this graph (once; an offline context has no way to). */
  attach(stream: MediaStream): void {
    if (this.source) return
    const raw = this.gate.context.rawContext
    if (!("createMediaStreamSource" in raw)) return
    this.source = (raw as AudioContext).createMediaStreamSource(stream)
    Tone.connect(this.source, this.liveGain)
    if (this.capture) Tone.connect(this.source, this.capture)
  }

  get attached(): boolean {
    return this.source !== null
  }

  /** The gate at a step: only a change is scheduled, so the sound runs unbroken across lit steps. */
  gateStep(open: boolean, time: number): void {
    if (open === this.open) return
    this.open = open
    const gain = this.gate.gain
    gain.cancelScheduledValues(time)
    gain.setValueAtTime(gain.getValueAtTime(time), time)
    gain.linearRampToValueAtTime(open ? 1 : 0, time + GATE_FADE)
  }

  /** The first step of bar `bar`: where the loop's cycle begins, it starts over, at the clock's tempo. */
  barStart(bar: number, time: number, bpm: number): void {
    if (!this.player.loaded || !restartsAt(bar, this.params.bars)) return
    this.player.playbackRate = bpm / this.params.loopBpm
    if (this.player.state === "started") this.player.restart(time, 0)
    else this.player.start(time, 0)
  }

  /** The clock stopped at `time`: shut the gate, stop the loop. */
  reset(time: number): void {
    this.gateStep(false, time)
    if (this.player.state === "started") this.player.stop(time)
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

  setLevel(_id: "gate", _level: number): void {}

  /**
   * Record the input from `start` (context seconds) for `seconds`, exactly:
   * resolves with the mono buffer once the end frame has passed — shorter if
   * `stopRecording` cut it, null if `cancelRecording` dropped it. The worklet
   * is loaded on the first take.
   */
  async record(start: number, seconds: number): Promise<AudioBuffer | null> {
    const capture = await this.captureNode()
    const { sampleRate } = this.gate.context
    const length = Math.round(seconds * sampleRate)
    const taken = new Promise<Float32Array | null>((resolve) => {
      capture.port.onmessage = (e: MessageEvent<Float32Array | null>) => resolve(e.data)
    })
    capture.port.postMessage({ start: Math.round(start * sampleRate), length })
    const samples = await taken
    if (!samples || samples.length === 0) return null
    const buffer = (this.gate.context.rawContext as BaseAudioContext).createBuffer(
      1,
      samples.length,
      sampleRate,
    )
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    return buffer
  }

  /** End the take in progress at `at` (context seconds) instead of its planned end. */
  stopRecording(at: number): void {
    this.capture?.port.postMessage({ stopAt: Math.round(at * this.gate.context.sampleRate) })
  }

  /** Drop the take in progress: `record` resolves with null. */
  cancelRecording(): void {
    this.capture?.port.postMessage({ cancel: true })
  }

  private async captureNode(): Promise<AudioWorkletNode> {
    if (this.capture) return this.capture
    const context = this.gate.context
    await context.addAudioWorkletModule(new URL("../capture.worklet.js", import.meta.url).href)
    const node = context.createAudioWorkletNode(CAPTURE_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    })
    // Its (silent) output has to reach the destination, or the graph never runs the processor.
    this.captureSink = new Tone.Gain({ gain: 0, context })
    Tone.connect(node, this.captureSink)
    this.captureSink.connect(context.destination)
    if (this.source) Tone.connect(this.source, node)
    this.capture = node
    return node
  }

  /** The recorded loop, as taken or decoded from storage. */
  setLoop(buffer: AudioBuffer): void {
    this.player.buffer.set(buffer)
  }

  /** A stored loop's bytes (a WAV) decoded into the player, in its own context. */
  async setLoopBytes(data: ArrayBuffer): Promise<void> {
    const decoded = await this.player.context.decodeAudioData(data.slice(0))
    this.player.buffer.set(decoded)
  }

  clearLoop(): void {
    if (this.player.state === "started") this.player.stop()
    this.player.buffer.dispose()
    this.player.buffer = new Tone.ToneAudioBuffer()
  }

  get hasLoop(): boolean {
    return this.player.loaded
  }

  set<K extends keyof MicParams>(key: K, value: MicParams[K]): void {
    this.params = { ...this.params, [key]: value }
    switch (key) {
      case "live":
      case "liveLevel":
        this.liveGain.gain.rampTo(this.params.live ? this.params.liveLevel : 0, RAMP)
        break
      case "loopLevel":
        this.loopGain.gain.rampTo(value as number, RAMP)
        break
      case "filterType":
        this.filter.type = value as MicParams["filterType"]
        break
      case "cutoff":
        this.cutoff.rampTo(value as number, RAMP)
        break
      case "resonance":
        this.filter.Q.rampTo(value as number, RAMP)
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
    this.capture?.disconnect()
    this.capture = null
    this.captureSink?.dispose()
    this.player.dispose()
    this.liveGain.dispose()
    this.loopGain.dispose()
    this.gate.dispose()
    this.cutoff.dispose()
    this.filter.dispose()
  }
}
