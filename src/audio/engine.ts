import * as Tone from "tone"

import { CHANNEL_IDS, type ChannelId } from "../state/channels"
import {
  DRUM_VOICES,
  PAD_IDS,
  PERC_VOICES,
  type DrumVoiceId,
  type HitVoiceId,
  type PadId,
  type PercVoiceId,
  type PolyInstrumentId,
} from "../state/pattern"
import { resolvePlayingPattern } from "../state/patterns"
import {
  useRackStore,
  type BassParams,
  type EpParams,
  type FxParams,
  type PadParams,
  type PolyParams,
  type StringsParams,
  type SynthParams,
} from "../state/store"
import { BassVoice } from "./devices/bass"
import { DrumKit } from "./devices/drums"
import { MonoVoice } from "./devices/monoSynth"
import { PercKit } from "./devices/perc"
import { EPiano, PolyPad, Strings, type PolyInstrument } from "./devices/polySynths"
import { SamplerKit } from "./devices/sampler"
import { deleteSample, putSample } from "./sampleStore"
import { Scheduler } from "./scheduler"
import type { Voice } from "./types"

/** A mixer channel: level into the master bus plus a send into the FX bus. */
interface Channel {
  input: Tone.Gain
  send: Tone.Gain
  meter: Tone.Meter
  scope: Tone.Waveform
  level: number
  muted: boolean
}

/** Samples per oscilloscope frame. */
const SCOPE_SIZE = 256

/** Where a level meter can look. */
export type LevelSource = ChannelId | "master"
export type Levels = Readonly<Record<LevelSource, number>>

/** Meter ballistics: enough smoothing to read, little enough to bounce. */
const METER_SMOOTHING = 0.85

/** Ramp length for parameter changes — long enough to avoid clicks, short enough to feel direct. */
const RAMP = 0.03
/** Changing the reverb tail re-renders its impulse response; coalesce knob drags. */
const REVERB_DEBOUNCE_MS = 150

/**
 * The single audio engine. Owns every Tone node; React never creates one.
 *
 * Signal flow:
 *
 *   voice ─▶ channel.input ─┬─▶ master ─▶ destination
 *                           └─▶ channel.send ─▶ fx.input ─▶ delay ─▶ reverb ─▶ master
 *
 * `build()` runs behind a user gesture (`Tone.start()`), is idempotent and
 * always leaves the same node graph in place.
 */
export class AudioEngine {
  private master: Tone.Gain | null = null
  private fxInput: Tone.Gain | null = null
  private delay: Tone.FeedbackDelay | null = null
  private reverb: Tone.Reverb | null = null
  private reverbDecayTimer: ReturnType<typeof setTimeout> | null = null
  private masterMeter: Tone.Meter | null = null
  private readonly channels = new Map<ChannelId, Channel>()
  private readonly voices = new Map<HitVoiceId, Voice>()
  private drums: DrumKit | null = null
  private perc: PercKit | null = null
  private sampler: SamplerKit | null = null
  private synth: MonoVoice | null = null
  private bass: BassVoice | null = null
  private poly: PolyPad | null = null
  private ep: EPiano | null = null
  private strings: Strings | null = null
  private scheduler: Scheduler | null = null

  get isBuilt(): boolean {
    return this.master !== null
  }

  /** Create the node graph once. Safe to call repeatedly. */
  build(): this {
    if (this.master) return this
    const state = useRackStore.getState()

    const master = new Tone.Gain(state.masterVolume).toDestination()
    this.masterMeter = new Tone.Meter({ normalRange: true, smoothing: METER_SMOOTHING })
    master.connect(this.masterMeter)
    const reverb = new Tone.Reverb({ decay: state.fx.reverbDecay, wet: 1 }).connect(master)
    const delay = new Tone.FeedbackDelay({
      delayTime: state.fx.delayTime,
      feedback: state.fx.feedback,
      wet: 0.5,
    }).connect(reverb)
    const fxInput = new Tone.Gain(1).connect(delay)

    for (const id of CHANNEL_IDS) {
      const level = state.mix.level[id]
      const muted = state.mix.mute[id]
      const input = new Tone.Gain(muted ? 0 : level).connect(master)
      const send = new Tone.Gain(state.mix.send[id]).connect(fxInput)
      const meter = new Tone.Meter({ normalRange: true, smoothing: METER_SMOOTHING })
      const scope = new Tone.Waveform(SCOPE_SIZE)
      input.connect(send)
      input.connect(meter)
      input.connect(scope)
      this.channels.set(id, { input, send, meter, scope, level, muted })
    }

    this.drums = new DrumKit(this.channelInput("drums"), state.drumLevels)
    for (const id of DRUM_VOICES) this.voices.set(id, this.drums.voice(id))
    this.perc = new PercKit(this.channelInput("perc"), state.percLevels)
    for (const id of PERC_VOICES) this.voices.set(id, this.perc.voice(id))
    this.sampler = new SamplerKit(this.channelInput("sampler"), state.pads)
    for (const id of PAD_IDS) this.voices.set(id, this.sampler.voice(id))
    void this.sampler.loadStored()
    this.synth = new MonoVoice(this.channelInput("synth"), state.synthParams)
    this.bass = new BassVoice(this.channelInput("bass"), state.bassParams)
    this.poly = new PolyPad(this.channelInput("poly"), state.polyParams)
    this.ep = new EPiano(this.channelInput("ep"), state.epParams)
    this.strings = new Strings(this.channelInput("strings"), state.stringsParams)

    this.scheduler = new Scheduler({
      getPattern: (bar) => {
        const s = useRackStore.getState()
        return resolvePlayingPattern(s.patterns, s.activePattern, s.chain, bar)
      },
      getSwing: () => useRackStore.getState().swing,
      sixteenthSeconds: () => Tone.getTransport().toSeconds("16n"),
      trigger: (voice, time) => this.voices.get(voice)?.trigger(time),
      triggerNote: (note, time) => this.synth?.trigger(note, time),
      triggerBass: (event, time, stepSeconds) => this.bass?.play(event, time, stepSeconds),
      triggerPoly: (instrument, notes, time) =>
        this.polyInstrument(instrument)?.trigger(notes, time),
      onStep: (step, index, bar) => useRackStore.getState().setPlayhead(step, index, bar),
    })

    this.master = master
    this.reverb = reverb
    this.delay = delay
    this.fxInput = fxInput
    return this
  }

  /** Unlock the audio context (must be called from a user gesture) and start the transport. */
  async start(): Promise<void> {
    await Tone.start()
    this.build()
    this.scheduler?.start()
    Tone.getTransport().start()
  }

  /** Stop the transport and rewind to the first step of the first bar. */
  stop(): void {
    Tone.getTransport().stop()
    this.scheduler?.reset()
    this.bass?.reset()
  }

  setBpm(bpm: number): void {
    const transport = Tone.getTransport()
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

  /** Channel level into the master bus, 0–1. */
  setChannelVolume(channel: ChannelId, level: number): void {
    const ch = this.channels.get(channel)
    if (!ch) return
    ch.level = level
    this.applyChannelGain(ch)
  }

  /** Silence a channel without losing its level. */
  setChannelMute(channel: ChannelId, muted: boolean): void {
    const ch = this.channels.get(channel)
    if (!ch) return
    ch.muted = muted
    this.applyChannelGain(ch)
  }

  private applyChannelGain(ch: Channel): void {
    ch.input.gain.rampTo(ch.muted ? 0 : ch.level, RAMP)
  }

  /**
   * Current signal level of every channel and the master, 0–1 linear amplitude
   * (RMS, smoothed). Zeros before build(). Read from a UI animation frame — it
   * allocates nothing.
   */
  getLevels(): Levels {
    const out = {} as Record<LevelSource, number>
    for (const id of CHANNEL_IDS) out[id] = this.readMeter(this.channels.get(id)?.meter)
    out.master = this.readMeter(this.masterMeter)
    return out
  }

  /**
   * The last SCOPE_SIZE samples of a channel, −1…1, for drawing. Null before
   * build(). The array is the analyser's own buffer — read it, don't keep it.
   */
  getWaveform(channel: ChannelId): Float32Array | null {
    return this.channels.get(channel)?.scope.getValue() ?? null
  }

  private readMeter(meter: Tone.Meter | null | undefined): number {
    if (!meter) return 0
    const value = meter.getValue()
    return typeof value === "number" ? value : (value[0] ?? 0)
  }

  /** How much of a channel goes to the FX bus, 0–1. */
  setSend(channel: ChannelId, level: number): void {
    this.channels.get(channel)?.send.gain.rampTo(level, RAMP)
  }

  /** Per-voice level on the DR-4, 0–1. */
  setDrumLevel(voice: DrumVoiceId, level: number): void {
    this.drums?.setLevel(voice, level)
  }

  /** Per-voice level on the PERC-6, 0–1. */
  setPercLevel(voice: PercVoiceId, level: number): void {
    this.perc?.setLevel(voice, level)
  }

  /** Pitch, decay and level of one SMP-8 pad. */
  setPadParams(pad: PadId, params: PadParams): void {
    this.sampler?.setParams(pad, params)
  }

  /**
   * Put a file on a pad: persist the bytes in the browser first, then — if
   * the graph exists — decode them into the player. Before the first Play the
   * sampler picks them up from storage when it is built.
   */
  async importSample(pad: PadId, name: string, data: ArrayBuffer): Promise<void> {
    await putSample(pad, { name, data })
    if (this.sampler) await this.sampler.setSample(pad, data)
  }

  async clearSample(pad: PadId): Promise<void> {
    await deleteSample(pad)
    this.sampler?.clearSample(pad)
  }

  /** Audition a one-shot voice now (outside the sequence), e.g. from a pad. Requires build(). */
  triggerHit(voice: HitVoiceId): void {
    this.voices.get(voice)?.trigger(Tone.now())
  }

  /** One MONO-1 parameter. */
  setSynthParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
    this.synth?.set(key, value)
  }

  /** One BASS-2 parameter. */
  setBassParam<K extends keyof BassParams>(key: K, value: BassParams[K]): void {
    this.bass?.set(key, value)
  }

  /** One POLY-4 parameter. */
  setPolyParam<K extends keyof PolyParams>(key: K, value: PolyParams[K]): void {
    this.poly?.set(key, value)
  }

  /** One EP-1 parameter. */
  setEpParam<K extends keyof EpParams>(key: K, value: EpParams[K]): void {
    this.ep?.set(key, value)
  }

  /** One STR-6 parameter. */
  setStringsParam<K extends keyof StringsParams>(key: K, value: StringsParams[K]): void {
    this.strings?.set(key, value)
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
   * Push every parameter from the store into the graph — after loading a song.
   * Before build() only the tempo matters; the rest is read at build time.
   */
  syncFromStore(): void {
    const s = useRackStore.getState()
    this.setBpm(s.bpm)
    if (!this.isBuilt) return
    this.setMasterVolume(s.masterVolume)
    for (const voice of DRUM_VOICES) this.setDrumLevel(voice, s.drumLevels[voice])
    for (const voice of PERC_VOICES) this.setPercLevel(voice, s.percLevels[voice])
    for (const pad of PAD_IDS) this.setPadParams(pad, s.pads[pad])
    for (const key of keysOf(s.synthParams)) this.setSynthParam(key, s.synthParams[key])
    for (const key of keysOf(s.bassParams)) this.setBassParam(key, s.bassParams[key])
    for (const key of keysOf(s.polyParams)) this.setPolyParam(key, s.polyParams[key])
    for (const key of keysOf(s.epParams)) this.setEpParam(key, s.epParams[key])
    for (const key of keysOf(s.stringsParams)) this.setStringsParam(key, s.stringsParams[key])
    for (const ch of CHANNEL_IDS) {
      this.setChannelVolume(ch, s.mix.level[ch])
      this.setChannelMute(ch, s.mix.mute[ch])
      this.setSend(ch, s.mix.send[ch])
    }
    for (const key of keysOf(s.fx)) this.setFxParam(key, s.fx[key])
  }

  private polyInstrument(id: PolyInstrumentId): PolyInstrument | null {
    switch (id) {
      case "poly":
        return this.poly
      case "ep":
        return this.ep
      case "strings":
        return this.strings
    }
  }

  private setReverbDecay(seconds: number): void {
    if (this.reverbDecayTimer) clearTimeout(this.reverbDecayTimer)
    this.reverbDecayTimer = setTimeout(() => {
      this.reverbDecayTimer = null
      if (this.reverb) this.reverb.decay = seconds
    }, REVERB_DEBOUNCE_MS)
  }

  /** Input node for a device that belongs to `channel`. Only valid after build(). */
  private channelInput(channel: ChannelId): Tone.Gain {
    const ch = this.channels.get(channel)
    if (!ch) throw new Error(`AudioEngine: channel "${channel}" requested before build()`)
    return ch.input
  }

  /** Tear everything down. Only used when the whole rack goes away. */
  dispose(): void {
    if (this.reverbDecayTimer) clearTimeout(this.reverbDecayTimer)
    this.scheduler?.dispose()
    this.drums?.dispose()
    this.perc?.dispose()
    this.sampler?.dispose()
    this.synth?.dispose()
    this.bass?.dispose()
    this.poly?.dispose()
    this.ep?.dispose()
    this.strings?.dispose()
    for (const { input, send, meter, scope } of this.channels.values()) {
      input.dispose()
      send.dispose()
      meter.dispose()
      scope.dispose()
    }
    this.channels.clear()
    this.voices.clear()
    this.masterMeter?.dispose()
    this.masterMeter = null
    this.fxInput?.dispose()
    this.delay?.dispose()
    this.reverb?.dispose()
    this.master?.dispose()
    this.reverbDecayTimer = null
    this.scheduler = null
    this.drums = null
    this.perc = null
    this.sampler = null
    this.synth = null
    this.bass = null
    this.poly = null
    this.ep = null
    this.strings = null
    this.fxInput = null
    this.delay = null
    this.reverb = null
    this.master = null
  }
}

const keysOf = <T extends object>(o: T) => Object.keys(o) as (keyof T)[]

let instance: AudioEngine | null = null

/** Always returns the same engine. */
export function getEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine()
  return instance
}
