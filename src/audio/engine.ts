import * as Tone from "tone"

import type { Instance, KindParams } from "../state/instances"
import { modSwing, type ModParams, type ModTarget } from "../state/mod"
import { PAD_IDS, type Kind, type PadId } from "../state/pattern"
import { resolvePlayingPattern } from "../state/patterns"
import {
  useRackStore,
  type FilterParams,
  type FxParams,
  type PadParams,
  type RackState,
} from "../state/store"
import { BassVoice } from "./devices/bass"
import { DrumKit } from "./devices/drums"
import { MonoVoice } from "./devices/monoSynth"
import { PercKit } from "./devices/perc"
import { EPiano, PolyPad, Strings } from "./devices/polySynths"
import { installTonePatches } from "./tonePatches"
import { SamplerKit } from "./devices/sampler"
import { deleteSample, putSample, sampleKey } from "./sampleStore"
import { Scheduler } from "./scheduler"
import type { ModHooks } from "./types"

/** The sound-making object behind one instance. */
type Device =
  | { kind: "drums"; kit: DrumKit }
  | { kind: "perc"; kit: PercKit }
  | { kind: "sampler"; kit: SamplerKit }
  | { kind: "synth"; voice: MonoVoice }
  | { kind: "bass"; voice: BassVoice }
  | { kind: "poly"; poly: PolyPad }
  | { kind: "ep"; poly: EPiano }
  | { kind: "strings"; poly: Strings }

/** One instance in the graph: its mixer strip, analysers and device. */
interface Strip {
  id: string
  input: Tone.Gain
  send: Tone.Gain
  meter: Tone.Meter
  /** The strip's own filter, between the device and the input — kinds without a filter of their own. */
  filter: Tone.Filter | null
  /** The strip filter's cutoff as a signal, so the modulators can sum with it. */
  filterBase: Tone.Signal<"frequency"> | null
  /** Saturation after the filter; `wet` is the drive knob. */
  drive: Tone.Distortion
  /** A gain the level modulators move — separate from `input`, which mute and solo own. */
  trem: Tone.Gain
  tremBase: Tone.Signal
  /** Each LFO exists only while it points somewhere: a running oscillator is not free on a phone. */
  lfos: [Tone.LFO | null, Tone.LFO | null]
  /** Where each LFO is connected, to know when to rewire. */
  lfoTargets: [ModTarget, ModTarget]
  /** Per-step random offset, rolled by the scheduler's tick. */
  random: Tone.Signal
  randomTarget: ModTarget
  randomAmount: number
  /** The cutoff the modulators swing around — the strip filter's, or the device's own. */
  cutoffHz: number
  level: number
  muted: boolean
  /** Heard alone: while any strip is soloed, the ones that are not fall silent. */
  solo: boolean
  device: Device
}

/** Where a level meter can look: an instance id, or the master. */
export type LevelSource = string

/** What the graph is built from and what the scheduler resolves against, read fresh each time. */
export type EngineState = Pick<
  RackState,
  | "swing"
  | "masterVolume"
  | "fx"
  | "instances"
  | "patterns"
  | "activePattern"
  | "chain"
  | "followSong"
  | "solo"
>

/**
 * Where an engine gets its state: the live one reads the store and publishes
 * the playhead back to it; an offline render reads a song and publishes nothing.
 */
export interface EngineSource {
  getState: () => EngineState
  onStep?: (step: number, patternIndex: number, bar: number) => void
}

const storeSource: EngineSource = {
  getState: () => useRackStore.getState(),
  onStep: (step, index, bar) => useRackStore.getState().setPlayhead(step, index, bar),
}

/** The melodic devices' modulation hooks; a kit has none. */
const hooksOf = (device: Device): ModHooks | null =>
  "kit" in device ? null : "voice" in device ? device.voice : device.poly

/** Ramp length for parameter changes — long enough to avoid clicks, short enough to feel direct. */
const RAMP = 0.03
/** Changing the reverb tail re-renders its impulse response; coalesce knob drags. */
const REVERB_DEBOUNCE_MS = 150
/** Meter ballistics: enough smoothing to read, little enough to bounce. */
const METER_SMOOTHING = 0.85
/** The drive stage's curve; the knob only sets how much of it is heard (`wet`). */
const DRIVE_CURVE = 0.5

/**
 * The single audio engine. Owns every Tone node; React never creates one.
 *
 * Signal flow, per instance:
 *
 *   device ─▶ strip.input ─┬─▶ master ─▶ destination
 *                          └─▶ strip.send ─▶ fx.input ─▶ delay ─▶ reverb ─▶ master
 *
 * `build()` runs behind a user gesture (`Tone.start()`), is idempotent and
 * always leaves the same node graph in place. Instances added or removed
 * afterwards are wired in and out live.
 */
export class AudioEngine {
  private master: Tone.Gain | null = null
  private masterMeter: Tone.Meter | null = null
  private fxInput: Tone.Gain | null = null
  private delay: Tone.FeedbackDelay | null = null
  private reverb: Tone.Reverb | null = null
  private reverbDecayTimer: ReturnType<typeof setTimeout> | null = null
  private readonly strips = new Map<string, Strip>()
  private scheduler: Scheduler | null = null
  private compressor: Tone.Compressor | null = null
  private limiter: Tone.Limiter | null = null
  /** The context the graph was built in — the live one, or an offline render's. */
  private context: Tone.BaseContext | null = null
  private readonly source: EngineSource

  constructor(source: EngineSource = storeSource) {
    this.source = source
  }

  get isBuilt(): boolean {
    return this.master !== null
  }

  /** The transport of the context the graph lives in; the global one until build(). */
  private get transport(): ReturnType<typeof Tone.getTransport> {
    return this.context?.transport ?? Tone.getTransport()
  }

  /** Create the node graph once, in whatever context is current. Safe to call repeatedly. */
  build(): this {
    if (this.master) return this
    installTonePatches()
    this.context = Tone.getContext()
    const state = this.source.getState()

    // Master glue: a gentle bus compressor for punch and a brickwall so nothing clips —
    // the difference between a pile of synths and a mix.
    const limiter = new Tone.Limiter(-1).toDestination()
    const compressor = new Tone.Compressor({
      threshold: -14,
      ratio: 3,
      attack: 0.008,
      release: 0.15,
      knee: 6,
    }).connect(limiter)
    const master = new Tone.Gain(state.masterVolume).connect(compressor)
    this.masterMeter = new Tone.Meter({ normalRange: true, smoothing: METER_SMOOTHING })
    limiter.connect(this.masterMeter)
    this.compressor = compressor
    this.limiter = limiter
    const reverb = new Tone.Reverb({ decay: state.fx.reverbDecay, wet: 1 }).connect(master)
    const delay = new Tone.FeedbackDelay({
      delayTime: state.fx.delayTime,
      feedback: state.fx.feedback,
      wet: 0.5,
    }).connect(reverb)
    const fxInput = new Tone.Gain(1).connect(delay)

    this.master = master
    this.reverb = reverb
    this.delay = delay
    this.fxInput = fxInput

    for (const inst of state.instances) this.addInstance(inst)

    const { onStep } = this.source
    this.scheduler = new Scheduler({
      getPattern: (bar) => {
        const s = this.source.getState()
        // A slot picked from the bank loops on its own until the song is resumed.
        return resolvePlayingPattern(s.patterns, s.activePattern, s.followSong ? s.chain : [], bar)
      },
      getSwing: () => this.source.getState().swing,
      sixteenthSeconds: () => this.transport.toSeconds("16n"),
      onTick: (time) => this.stepMod(time),
      trigger: (id, voice, time) => this.hit(id, voice, time),
      triggerNote: (id, note, time) => {
        const d = this.strips.get(id)?.device
        if (d?.kind === "synth") d.voice.trigger(note, time)
      },
      triggerBass: (id, event, time, stepSeconds) => {
        const d = this.strips.get(id)?.device
        if (d?.kind === "bass") d.voice.play(event, time, stepSeconds)
      },
      triggerPoly: (id, notes, time) => {
        const d = this.strips.get(id)?.device
        if (d && "poly" in d) d.poly.trigger(notes, time)
      },
      // Draw callbacks queued before a stop still land after it; a stopped transport publishes nothing,
      // so the readout stays at "--" instead of freezing on the last step.
      onStep: onStep
        ? (step, index, bar) => {
            if (this.transport.state === "started") onStep(step, index, bar)
          }
        : undefined,
    })
    return this
  }

  /**
   * Resolves once everything asynchronous in the graph is in place: the
   * reverb's impulse response and the samplers' stored samples. The live
   * engine plays without waiting (a pad joins when it is decoded); an offline
   * render must wait, or it renders silence for them.
   */
  async ready(): Promise<void> {
    const pending: Promise<unknown>[] = []
    if (this.reverb) pending.push(this.reverb.ready)
    for (const { device } of this.strips.values()) {
      if (device.kind === "sampler") pending.push(device.kit.ready)
    }
    await Promise.allSettled(pending)
  }

  /** Wire a new instance into the graph. No-op before build() — build() reads the store itself. */
  addInstance(inst: Instance): void {
    if (!this.master || !this.fxInput || this.strips.has(inst.id)) return
    const input = new Tone.Gain(0).connect(this.master)
    const send = new Tone.Gain(inst.send).connect(this.fxInput)
    const meter = new Tone.Meter({ normalRange: true, smoothing: METER_SMOOTHING })
    input.connect(send)
    input.connect(meter)
    // device → [filter] → drive → trem → input. Modulators sum into signals the strip owns.
    const trem = new Tone.Gain(0).connect(input)
    const tremBase = new Tone.Signal(1).connect(trem.gain)
    const drive = new Tone.Distortion({ distortion: DRIVE_CURVE, wet: inst.mod.drive }).connect(
      trem,
    )
    const filter = inst.filter
      ? new Tone.Filter({ type: inst.filter.type, Q: inst.filter.resonance, rolloff: -24 }).connect(
          drive,
        )
      : null
    const filterBase = filter
      ? new Tone.Signal({ value: inst.filter!.cutoff, units: "frequency" }).connect(
          filter.frequency,
        )
      : null
    const strip: Strip = {
      id: inst.id,
      input,
      send,
      meter,
      filter,
      filterBase,
      drive,
      trem,
      tremBase,
      lfos: [null, null],
      lfoTargets: ["off", "off"],
      random: new Tone.Signal(0),
      randomTarget: "off",
      randomAmount: 0,
      cutoffHz: inst.filter?.cutoff ?? ("cutoff" in inst.params ? inst.params.cutoff : 1000),
      level: inst.level,
      muted: inst.mute,
      solo: this.source.getState().solo[inst.id] === true,
      device: this.createDevice(inst, filter ?? drive),
    }
    this.strips.set(inst.id, strip)
    this.applyMod(strip, inst.mod)
    // Born at its resting gain — and, if it is the first solo, the others go quiet.
    if (strip.solo) this.applyAllGains()
    else input.gain.value = this.gainOf(strip)
  }

  private createDevice(inst: Instance, output: Tone.ToneAudioNode): Device {
    switch (inst.kind) {
      case "drums":
        return { kind: inst.kind, kit: new DrumKit(output, inst.params) }
      case "perc":
        return { kind: inst.kind, kit: new PercKit(output, inst.params) }
      case "sampler":
        return { kind: inst.kind, kit: new SamplerKit(output, inst.id, inst.params) }
      case "synth":
        return { kind: inst.kind, voice: new MonoVoice(output, inst.params) }
      case "bass":
        return { kind: inst.kind, voice: new BassVoice(output, inst.params) }
      case "poly":
        return { kind: inst.kind, poly: new PolyPad(output, inst.params) }
      case "ep":
        return { kind: inst.kind, poly: new EPiano(output, inst.params) }
      case "strings":
        return { kind: inst.kind, poly: new Strings(output, inst.params) }
    }
  }

  /** Take an instance out of the graph and free its nodes. */
  removeInstance(id: string): void {
    const strip = this.strips.get(id)
    if (!strip) return
    this.strips.delete(id)
    this.disposeDevice(strip.device)
    for (const lfo of strip.lfos) lfo?.dispose()
    strip.random.dispose()
    strip.filterBase?.dispose()
    strip.filter?.dispose()
    strip.drive.dispose()
    strip.tremBase.dispose()
    strip.trem.dispose()
    strip.input.dispose()
    strip.send.dispose()
    strip.meter.dispose()
    // Taking out the last soloed strip gives the others their voice back.
    if (strip.solo) this.applyAllGains()
  }

  private disposeDevice(device: Device): void {
    if ("kit" in device) device.kit.dispose()
    else if ("voice" in device) device.voice.dispose()
    else device.poly.dispose()
  }

  /** Unlock the audio context (must be called from a user gesture) and start the transport. */
  async start(): Promise<void> {
    await Tone.start()
    this.build()
    this.run()
  }

  /** Arm the sequence and start the graph's transport — now, or at a context time. Requires build(). */
  run(at?: number): void {
    this.scheduler?.start()
    this.transport.start(at)
  }

  /** True while the audio context is actually producing sound. */
  audioRunning(): boolean {
    return Tone.getContext().state === "running"
  }

  /**
   * Ask the context to run again. iOS marks it "interrupted" after a lock
   * screen, a call or an app switch and the transport keeps ticking in
   * silence; a call from a tap brings the sound back.
   */
  resumeAudio(): Promise<void> {
    return Tone.getContext().resume()
  }

  /** Stop the transport and rewind to the first step of the first bar. */
  stop(): void {
    this.transport.stop()
    this.scheduler?.reset()
    this.release(this.transport.now())
  }

  /** Let go of anything a device holds open across steps (a BASS-2 slide) — the clock stopped at `time`. */
  release(time: number): void {
    for (const { device } of this.strips.values()) {
      if (device.kind === "bass") device.voice.reset(time)
    }
  }

  setBpm(bpm: number): void {
    const transport = this.transport
    if (this.isBuilt) {
      transport.bpm.rampTo(bpm, 0.05)
    } else {
      transport.bpm.value = bpm
    }
  }

  /** Master level, 0–1. */
  setMasterVolume(level: number): void {
    this.master?.gain.rampTo(level, RAMP)
  }

  /** Instance level into the master bus, 0–1. */
  setInstanceLevel(id: string, level: number): void {
    const strip = this.strips.get(id)
    if (!strip) return
    strip.level = level
    this.applyGain(strip)
  }

  /** Silence an instance without losing its level. */
  setInstanceMute(id: string, muted: boolean): void {
    const strip = this.strips.get(id)
    if (!strip) return
    strip.muted = muted
    this.applyGain(strip)
  }

  /** Hear an instance on its own. Not saved with the song; a load clears it. */
  setInstanceSolo(id: string, solo: boolean): void {
    const strip = this.strips.get(id)
    if (!strip || strip.solo === solo) return
    strip.solo = solo
    // Every strip's gain depends on whether any solo is on.
    this.applyAllGains()
  }

  private applyGain(strip: Strip): void {
    strip.input.gain.rampTo(this.gainOf(strip), RAMP)
  }

  private applyAllGains(): void {
    for (const strip of this.strips.values()) this.applyGain(strip)
  }

  /** The strip's gain into the master: its level, unless it is muted or another strip is soloed. */
  private gainOf(strip: Strip): number {
    if (strip.muted) return 0
    if (strip.solo) return strip.level
    for (const other of this.strips.values()) if (other.solo) return 0
    return strip.level
  }

  /** How much of an instance goes to the FX bus, 0–1. */
  setInstanceSend(id: string, level: number): void {
    this.strips.get(id)?.send.gain.rampTo(level, RAMP)
  }

  /** Apply (part of) a strip filter: the type at once, cutoff and Q with a ramp. */
  setInstanceFilter(id: string, patch: Partial<FilterParams>): void {
    const strip = this.strips.get(id)
    if (!strip?.filter || !strip.filterBase) return
    if (patch.type !== undefined) strip.filter.type = patch.type
    if (patch.cutoff !== undefined) {
      strip.filterBase.rampTo(patch.cutoff, RAMP)
      this.setCutoffHz(strip, patch.cutoff)
    }
    if (patch.resonance !== undefined) strip.filter.Q.rampTo(patch.resonance, RAMP)
  }

  /** The whole modulation block of an instance, applied: tune, drive, both LFOs and the random source. */
  setInstanceMod(id: string, mod: ModParams): void {
    const strip = this.strips.get(id)
    if (strip) this.applyMod(strip, mod)
  }

  private makeLfo(p: ModParams["lfo"][number]): Tone.LFO {
    const lfo = new Tone.LFO({ type: p.shape, frequency: p.rate, min: -1, max: 1 })
    lfo.start()
    return lfo
  }

  private applyMod(strip: Strip, mod: ModParams): void {
    strip.drive.wet.rampTo(mod.drive, RAMP)
    hooksOf(strip.device)?.setTune(mod.tune)
    mod.lfo.forEach((p, i) => {
      const targets = this.targetParams(strip, p.target)
      // Nothing to reach: no oscillator at all.
      if (targets.length === 0) {
        strip.lfos[i]?.dispose()
        strip.lfos[i] = null
        strip.lfoTargets[i] = p.target
        return
      }
      let lfo = strip.lfos[i]
      if (!lfo) {
        lfo = this.makeLfo(p)
        strip.lfos[i] = lfo
        strip.lfoTargets[i] = "off"
      }
      lfo.type = p.shape
      lfo.frequency.rampTo(p.rate, RAMP)
      if (strip.lfoTargets[i] !== p.target) {
        lfo.disconnect()
        for (const param of targets) lfo.connect(param)
        strip.lfoTargets[i] = p.target
      }
      const swing = modSwing(p.target, p.amount, strip.cutoffHz)
      lfo.min = -swing
      lfo.max = swing
    })
    if (strip.randomTarget !== mod.random.target) {
      this.wire(strip, strip.random, mod.random.target)
      strip.randomTarget = mod.random.target
      strip.random.value = 0
    }
    strip.randomAmount = mod.random.amount
  }

  /** Connect a modulator to whatever `target` means on this strip; "off" (or nothing to reach) leaves it loose. */
  private wire(strip: Strip, source: Tone.Signal, target: ModTarget): void {
    source.disconnect()
    for (const param of this.targetParams(strip, target)) source.connect(param)
  }

  private targetParams(strip: Strip, target: ModTarget): Tone.InputNode[] {
    const hooks = hooksOf(strip.device)
    switch (target) {
      case "cutoff": {
        const param = strip.filter ? strip.filter.frequency : hooks?.cutoffInput()
        return param ? [param] : []
      }
      case "pitch":
        return hooks?.pitchInputs() ?? []
      case "level":
        return [strip.trem.gain]
      case "off":
        return []
    }
  }

  /** The cutoff moved: the modulators aiming at it swing around the new value. */
  private setCutoffHz(strip: Strip, hz: number): void {
    strip.cutoffHz = hz
    strip.lfos.forEach((lfo, i) => {
      if (!lfo || strip.lfoTargets[i] !== "cutoff") return
      const p = this.modOf(strip)?.lfo[i]
      if (!p) return
      const swing = modSwing("cutoff", p.amount, hz)
      lfo.min = -swing
      lfo.max = swing
    })
  }

  private modOf(strip: Strip): ModParams | undefined {
    return this.source.getState().instances.find((i) => i.id === strip.id)?.mod
  }

  /** One sixteenth begins: every strip with a random source rolls a new offset for it. */
  private stepMod(time: number): void {
    for (const strip of this.strips.values()) {
      if (strip.randomTarget === "off") continue
      const swing = modSwing(strip.randomTarget, strip.randomAmount, strip.cutoffHz)
      strip.random.setValueAtTime((Math.random() * 2 - 1) * swing, time)
    }
  }

  /**
   * Apply (part of) an instance's params. Kits take a levels record, the
   * sampler a pads record, the synths key/value pairs — each device decides
   * what ramps and what is a plain setter.
   */
  setInstanceParams(id: string, patch: Partial<KindParams[Kind]>): void {
    const strip = this.strips.get(id)
    const device = strip?.device
    if (!strip || !device) return
    const entries = Object.entries(patch as Record<string, unknown>)
    // A synth's own cutoff moved: its modulators swing around the new value.
    const cutoff = (patch as { cutoff?: unknown }).cutoff
    if (typeof cutoff === "number" && !strip.filter) this.setCutoffHz(strip, cutoff)
    switch (device.kind) {
      case "drums":
      case "perc":
        for (const [voice, level] of entries) {
          if (typeof level === "number") device.kit.setLevel(voice as never, level)
        }
        break
      case "sampler":
        for (const [pad, params] of entries) {
          if (PAD_IDS.includes(pad as PadId))
            device.kit.setParams(pad as PadId, params as PadParams)
        }
        break
      case "synth":
        for (const [key, value] of entries) device.voice.set(key as never, value as never)
        break
      case "bass":
        for (const [key, value] of entries) device.voice.set(key as never, value as never)
        break
      case "poly":
        for (const [key, value] of entries) device.poly.set(key as never, value as never)
        break
      case "ep":
        for (const [key, value] of entries) device.poly.set(key as never, value as never)
        break
      case "strings":
        for (const [key, value] of entries) device.poly.set(key as never, value as never)
        break
    }
  }

  /**
   * Put a file on a sampler pad: persist the bytes in the browser first, then
   * — if the device exists — decode them into the player. Before the first
   * Play the sampler picks them up from storage when it is built.
   */
  async importSample(id: string, pad: PadId, name: string, data: ArrayBuffer): Promise<void> {
    await putSample(sampleKey(id, pad), { name, data })
    const device = this.strips.get(id)?.device
    if (device?.kind === "sampler") await device.kit.setSample(pad, data)
  }

  async clearSample(id: string, pad: PadId): Promise<void> {
    await deleteSample(sampleKey(id, pad))
    const device = this.strips.get(id)?.device
    if (device?.kind === "sampler") device.kit.clearSample(pad)
  }

  private hit(id: string, voice: string, time: number): void {
    const device = this.strips.get(id)?.device
    if (device && "kit" in device) device.kit.voice(voice as never).trigger(time)
  }

  /** Audition one voice of a kit instance now (outside the sequence). Requires build(). */
  triggerHit(id: string, voice: string): void {
    this.hit(id, voice, this.transport.now())
  }

  /**
   * One FX-2 parameter. Delay time and feedback are Signals and ramp; the
   * reverb tail is not automatable — Tone re-renders the impulse response and
   * swaps it in, so it is debounced rather than applied per pointer move.
   */
  setFxParam<K extends keyof FxParams>(key: K, value: FxParams[K]): void {
    switch (key) {
      case "delayTime":
        this.delay?.delayTime.rampTo(value as FxParams["delayTime"], 0.05)
        break
      case "feedback":
        this.delay?.feedback.rampTo(value as number, RAMP)
        break
      case "reverbDecay":
        this.setReverbDecay(value as number)
        break
    }
  }

  /**
   * Current signal level of every instance and the master, 0–1 linear
   * amplitude (RMS, smoothed). Zeros before build(). Read from a UI animation
   * frame — it allocates one small object.
   */
  /** One meter, 0–1 — read only for the meters on screen, an analyser read is not free. */
  getLevel(source: LevelSource): number {
    return this.readMeter(source === "master" ? this.masterMeter : this.strips.get(source)?.meter)
  }

  private readMeter(meter: Tone.Meter | null | undefined): number {
    if (!meter) return 0
    const value = meter.getValue()
    return typeof value === "number" ? value : (value[0] ?? 0)
  }

  /**
   * Make the graph match the store — after loading a song. Instances that
   * vanished are torn down, new ones built, the rest get their params pushed.
   * Before build() only the tempo matters; the rest is read at build time.
   */
  syncFromStore(): void {
    const s = useRackStore.getState()
    this.setBpm(s.bpm)
    if (!this.isBuilt) return
    this.setMasterVolume(s.masterVolume)
    const wanted = new Set(s.instances.map((i) => i.id))
    for (const id of [...this.strips.keys()]) if (!wanted.has(id)) this.removeInstance(id)
    for (const inst of s.instances) {
      const strip = this.strips.get(inst.id)
      if (!strip || strip.device.kind !== inst.kind) {
        this.removeInstance(inst.id)
        this.addInstance(inst)
        continue
      }
      strip.level = inst.level
      strip.muted = inst.mute
      strip.solo = s.solo[inst.id] === true
      this.setInstanceSend(inst.id, inst.send)
      this.setInstanceParams(inst.id, inst.params)
      if (inst.filter) this.setInstanceFilter(inst.id, inst.filter)
      this.setInstanceMod(inst.id, inst.mod)
    }
    // Once, after every strip's flags are in: a solo changes what the others do.
    this.applyAllGains()
    for (const key of Object.keys(s.fx) as (keyof FxParams)[]) this.setFxParam(key, s.fx[key])
  }

  private setReverbDecay(seconds: number): void {
    if (this.reverbDecayTimer) clearTimeout(this.reverbDecayTimer)
    this.reverbDecayTimer = setTimeout(() => {
      this.reverbDecayTimer = null
      if (this.reverb) this.reverb.decay = seconds
    }, REVERB_DEBOUNCE_MS)
  }

  /** Tear everything down. Only used when the whole rack goes away. */
  dispose(): void {
    if (this.reverbDecayTimer) clearTimeout(this.reverbDecayTimer)
    this.scheduler?.dispose()
    for (const id of [...this.strips.keys()]) this.removeInstance(id)
    this.masterMeter?.dispose()
    this.fxInput?.dispose()
    this.delay?.dispose()
    this.reverb?.dispose()
    this.master?.dispose()
    this.compressor?.dispose()
    this.limiter?.dispose()
    this.compressor = null
    this.limiter = null
    this.reverbDecayTimer = null
    this.scheduler = null
    this.masterMeter = null
    this.fxInput = null
    this.delay = null
    this.reverb = null
    this.master = null
    this.context = null
  }
}

let instance: AudioEngine | null = null

/** Always returns the same engine. */
export function getEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine()
  return instance
}
