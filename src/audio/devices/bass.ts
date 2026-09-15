import * as Tone from "tone"

import type { BassParams } from "../../state/params"
import type { BassStepEvent } from "../../state/pattern"
import { transposeNote, type ModHooks } from "../types"
import { fatOscillator } from "./oscillators"

/** Ramp length for automatable parameter changes. */
const RAMP = 0.03
/** Filter sweep at full env depth, in octaves above the cutoff. */
const ENV_OCTAVES = 4
/** Accents sweep further and hit harder. */
const ACCENT_SWEEP = 1.5
const ACCENT_VELOCITY = 1
const PLAIN_VELOCITY = 0.6
/** Fraction of a step a non-slid note stays open. */
const GATE = 0.6
/** Fraction of a step a slide takes to reach the next note. */
const GLIDE = 0.5
/** Two oscillators a few cents apart: body without losing the sub. */
const UNISON = { count: 2, spread: 7 }

/**
 * BASS-2: a 303-style mono line on the bass channel.
 *
 * Slide keeps the gate open into the next step and glides there with
 * `setNote` instead of re-attacking, so the filter envelope does not restart —
 * the classic acid tie. Accent raises velocity and widens the filter sweep for
 * that one note. Both are decided per step by the pattern, so `play()` receives
 * every step, rests included, to know when to let a held slide go.
 */
export class BassVoice implements ModHooks {
  private readonly synth: Tone.MonoSynth
  private readonly drive: Tone.Distortion
  private params: BassParams
  /** A slide is holding the gate open into the next step. */
  private held = false
  private tune = 0

  constructor(output: Tone.ToneAudioNode, p: BassParams) {
    this.params = p
    // The 303 through a small overdrive: the resonance peak growls instead of whistling.
    this.drive = new Tone.Distortion({ distortion: 0.2, wet: 0.35 }).connect(output)
    this.synth = new Tone.MonoSynth({
      volume: -8,
      portamento: 0,
      oscillator: fatOscillator(p.waveform, UNISON.count, UNISON.spread),
      filter: { type: p.filterType, rolloff: -24, Q: p.resonance },
      filterEnvelope: {
        attack: 0.003,
        decay: p.decay,
        sustain: 0,
        release: 0.1,
        baseFrequency: p.cutoff,
        octaves: this.sweepFor(false),
      },
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
    }).connect(this.drive)
  }

  setTune(semitones: number): void {
    this.tune = semitones
  }

  cutoffInput(): Tone.Signal<"frequency"> {
    return this.synth.filter.frequency
  }

  pitchInputs(): Tone.Signal<"cents">[] {
    return [this.synth.detune]
  }

  private sweepFor(accent: boolean): number {
    return this.params.envMod * ENV_OCTAVES * (accent ? ACCENT_SWEEP : 1)
  }

  /** One step. `time` is the transport's audio-clock time; `stepSeconds` the step length. */
  play(event: BassStepEvent, time: number, stepSeconds: number): void {
    if (event.note === null) {
      if (this.held) {
        this.synth.triggerRelease(time)
        this.held = false
      }
      return
    }

    this.synth.filterEnvelope.octaves = this.sweepFor(event.accent)
    const note = transposeNote(event.note, this.tune)

    if (this.held) {
      // Arriving from a slide: glide, keep the envelope where it is.
      this.synth.portamento = stepSeconds * GLIDE
      this.synth.setNote(note, time)
    } else {
      this.synth.portamento = 0
      this.synth.triggerAttack(note, time, event.accent ? ACCENT_VELOCITY : PLAIN_VELOCITY)
    }

    if (event.slide) {
      this.held = true
    } else {
      this.synth.triggerRelease(time + stepSeconds * GATE)
      this.held = false
    }
  }

  /** Let go of anything held — the transport stopped at `time` (audio-clock seconds). */
  reset(time: number): void {
    if (this.held) this.synth.triggerRelease(time)
    this.held = false
  }

  set<K extends keyof BassParams>(key: K, value: BassParams[K]): void {
    this.params = { ...this.params, [key]: value }
    switch (key) {
      case "waveform":
        this.synth.set({
          oscillator: fatOscillator(value as BassParams["waveform"], UNISON.count, UNISON.spread),
        })
        break
      case "filterType":
        this.synth.filter.type = value as BassParams["filterType"]
        break
      case "cutoff":
        this.synth.filterEnvelope.baseFrequency = value as number
        break
      case "resonance":
        this.synth.filter.Q.rampTo(value as number, RAMP)
        break
      case "envMod":
        this.synth.filterEnvelope.octaves = this.sweepFor(false)
        break
      case "attack":
        this.synth.envelope.attack = value as number
        break
      case "decay":
        this.synth.envelope.decay = value as number
        this.synth.filterEnvelope.decay = value as number
        break
      case "sustain":
        this.synth.envelope.sustain = value as number
        break
      case "release":
        this.synth.envelope.release = value as number
        break
    }
  }

  dispose(): void {
    this.synth.dispose()
    this.drive.dispose()
  }
}
