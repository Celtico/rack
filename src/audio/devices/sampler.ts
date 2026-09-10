import * as Tone from "tone"

import type { PadParams } from "../../state/params"
import { PAD_IDS, type PadId } from "../../state/pattern"
import { getAllSamples, sampleKey } from "../sampleStore"
import type { Kit, Voice } from "../types"

/** Ramp length for level changes. */
const RAMP = 0.03
/** Short fade on stop so a cut sample never clicks. */
const FADE_OUT = 0.02

/**
 * SMP-8: eight pads, each a `Player` with its own level gain. Pitch is a
 * playback-rate change and decay a scheduled stop, both read from the pad's
 * params at trigger time. Samples arrive decoded from the engine; an empty pad
 * is silent. Each instance keeps its samples under its own storage keys.
 */
export class SamplerKit implements Kit<PadId> {
  private readonly players: Record<PadId, Tone.Player>
  private readonly levels: Record<PadId, Tone.Gain>
  private params: Readonly<Record<PadId, PadParams>>
  private readonly instanceId: string

  constructor(
    output: Tone.ToneAudioNode,
    instanceId: string,
    params: Readonly<Record<PadId, PadParams>>,
  ) {
    this.instanceId = instanceId
    this.params = params
    this.levels = {} as Record<PadId, Tone.Gain>
    this.players = {} as Record<PadId, Tone.Player>
    for (const id of PAD_IDS) {
      this.levels[id] = new Tone.Gain(params[id].level).connect(output)
      this.players[id] = new Tone.Player({ fadeOut: FADE_OUT }).connect(this.levels[id])
    }
  }

  /** Bring back whatever the browser has kept for this instance's pads. */
  async loadStored(): Promise<void> {
    const stored = await getAllSamples()
    await Promise.all(
      PAD_IDS.map(async (id) => {
        const sample = stored[sampleKey(this.instanceId, id)]
        if (sample) await this.setSample(id, sample.data)
      }),
    )
  }

  /** Decode a file's bytes and put them on a pad. */
  async setSample(id: PadId, data: ArrayBuffer): Promise<void> {
    // decodeAudioData detaches the buffer; work on a copy so the caller keeps its bytes.
    const decoded = await Tone.getContext().decodeAudioData(data.slice(0))
    this.players[id].buffer.set(decoded)
  }

  clearSample(id: PadId): void {
    this.players[id].buffer.dispose()
    this.players[id].buffer = new Tone.ToneAudioBuffer()
  }

  hasSample(id: PadId): boolean {
    return this.players[id].loaded
  }

  voice(id: PadId): Voice {
    return { trigger: (time) => this.trigger(id, time) }
  }

  trigger(id: PadId, time: number): void {
    const player = this.players[id]
    if (!player.loaded) return
    const { pitch, decay } = this.params[id]
    player.playbackRate = 2 ** (pitch / 12)
    player.start(time)
    player.stop(time + decay)
  }

  setLevel(id: PadId, level: number): void {
    this.levels[id].gain.rampTo(level, RAMP)
  }

  /** Pitch and decay are read at trigger time; level goes straight to the gain. */
  setParams(id: PadId, params: PadParams): void {
    this.params = { ...this.params, [id]: params }
    this.setLevel(id, params.level)
  }

  dispose(): void {
    for (const id of PAD_IDS) {
      this.players[id].dispose()
      this.levels[id].dispose()
    }
  }
}
