import * as Tone from "tone"

import { CHANNEL_IDS, type ChannelId } from "../state/channels"
import {
  DRUM_VOICES,
  PERC_VOICES,
  type DrumVoiceId,
  type HitVoiceId,
  type PercVoiceId,
} from "../state/pattern"
import { resolvePlayingPattern } from "../state/patterns"
import { useRackStore, type BassParams, type FxParams, type SynthParams } from "../state/store"
import { BassVoice } from "./devices/bass"
import { DrumKit } from "./devices/drums"
import { MonoVoice } from "./devices/monoSynth"
import { PercKit } from "./devices/perc"
import { Scheduler } from "./scheduler"
import type { Voice } from "./types"

/** A mixer channel: level into the master bus plus a send into the FX bus. */
interface Channel {
  input: Tone.Gain
  send: Tone.Gain
}

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
  private readonly channels = new Map<ChannelId, Channel>()
  private readonly voices = new Map<HitVoiceId, Voice>()
  private drums: DrumKit | null = null
  private perc: PercKit | null = null
  private synth: MonoVoice | null = null
  private bass: BassVoice | null = null
  private scheduler: Scheduler | null = null

  get isBuilt(): boolean {
    return this.master !== null
  }

  /** Create the node graph once. Safe to call repeatedly. */
  build(): this {
    if (this.master) return this
    const state = useRackStore.getState()

    const master = new Tone.Gain(state.masterVolume).toDestination()
    const reverb = new Tone.Reverb({ decay: state.fx.reverbDecay, wet: 1 }).connect(master)
    const delay = new Tone.FeedbackDelay({
      delayTime: state.fx.delayTime,
      feedback: state.fx.feedback,
      wet: 0.5,
    }).connect(reverb)
    const fxInput = new Tone.Gain(1).connect(delay)

    for (const id of CHANNEL_IDS) {
      const input = new Tone.Gain(state.mix.level[id]).connect(master)
      const send = new Tone.Gain(state.mix.send[id]).connect(fxInput)
      input.connect(send)
      this.channels.set(id, { input, send })
    }

    this.drums = new DrumKit(this.channelInput("drums"), state.drumLevels)
    for (const id of DRUM_VOICES) this.voices.set(id, this.drums.voice(id))
    this.perc = new PercKit(this.channelInput("perc"), state.percLevels)
    for (const id of PERC_VOICES) this.voices.set(id, this.perc.voice(id))
    this.synth = new MonoVoice(this.channelInput("synth"), state.synthParams)
    this.bass = new BassVoice(this.channelInput("bass"), state.bassParams)

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
      onStep: (step, index) => useRackStore.getState().setPlayhead(step, index),
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
    this.channels.get(channel)?.input.gain.rampTo(level, RAMP)
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
    for (const key of Object.keys(s.synthParams) as (keyof SynthParams)[]) {
      this.setSynthParam(key, s.synthParams[key])
    }
    for (const key of Object.keys(s.bassParams) as (keyof BassParams)[]) {
      this.setBassParam(key, s.bassParams[key])
    }
    for (const ch of CHANNEL_IDS) {
      this.setChannelVolume(ch, s.mix.level[ch])
      this.setSend(ch, s.mix.send[ch])
    }
    for (const key of Object.keys(s.fx) as (keyof FxParams)[]) {
      this.setFxParam(key, s.fx[key])
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
    this.synth?.dispose()
    this.bass?.dispose()
    for (const { input, send } of this.channels.values()) {
      input.dispose()
      send.dispose()
    }
    this.channels.clear()
    this.voices.clear()
    this.fxInput?.dispose()
    this.delay?.dispose()
    this.reverb?.dispose()
    this.master?.dispose()
    this.reverbDecayTimer = null
    this.scheduler = null
    this.drums = null
    this.perc = null
    this.synth = null
    this.bass = null
    this.fxInput = null
    this.delay = null
    this.reverb = null
    this.master = null
  }
}

let instance: AudioEngine | null = null

/** Always returns the same engine. */
export function getEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine()
  return instance
}
