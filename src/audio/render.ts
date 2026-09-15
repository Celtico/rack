import * as Tone from "tone"

import type { Song } from "../state/song"
import { clampSong } from "../state/store"
import { AudioEngine } from "./engine"

/** A song with no chain is one looping bar: export it a few times round, as it would sound. */
export const LOOP_BARS = 4
/** Room after the last bar for the reverb and delay to die away, at most. */
const MAX_TAIL_SECONDS = 8
/** The clock stops a hair before the bar line, so the bar after the last one never starts. */
const STOP_EARLY = 0.001

export interface RenderPlan {
  bars: number
  /** Where the clock stops. */
  barsSeconds: number
  /** Length of the rendered file. */
  seconds: number
}

/** How long an export is, from the song alone. Pure. */
export function renderPlan(song: Pick<Song, "bpm" | "chain" | "fx">): RenderPlan {
  const bars = song.chain.length || LOOP_BARS
  const barsSeconds = bars * 4 * (60 / song.bpm)
  const tail = Math.min(MAX_TAIL_SECONDS, song.fx.reverbDecay + 1)
  return { bars, barsSeconds, seconds: barsSeconds + tail }
}

/**
 * Render a song to audio faster than real time. A second engine is built from
 * the song — not the store — in an offline context, its clock run through the
 * chain once, and the master output (compressor and limiter included)
 * returned as a buffer. The live rack is untouched and may keep playing.
 * Sampler pads read the samples stored under their instance ids, like a load
 * of that song would.
 *
 * Not `Tone.Offline`: that swaps the *global* context for as long as its
 * callback runs, and this one has to wait for the reverb's impulse response
 * and the samplers' decodes — anything the live rack did meanwhile (Play, Add
 * unit, a load) would have built its nodes into the throwaway context. Here
 * the swap lasts one synchronous `build()`, and is undone even if it throws.
 */
export async function renderSong(raw: Song): Promise<AudioBuffer> {
  const song = clampSong(raw)
  const plan = renderPlan(song)
  // Solo is not part of a song: a render hears every machine.
  const state = { ...song, followSong: true, solo: {} }
  const engine = new AudioEngine({ getState: () => state })
  const live = Tone.getContext()
  const ctx = new Tone.OfflineContext(2, plan.seconds, live.sampleRate)
  try {
    Tone.setContext(ctx)
    try {
      ctx.transport.bpm.value = song.bpm
      engine.build()
      // Armed here too: the sequence is a Tone node, and it must be born in this context.
      // Nothing sounds until `render()`, so starting the clock before `ready()` is fine.
      engine.run(0)
      // A slide on the last step would hold the bass open through the whole tail.
      ctx.transport.once("stop", (time) => engine.release(time))
      ctx.transport.stop(plan.barsSeconds - STOP_EARLY)
    } finally {
      Tone.setContext(live)
    }
    await engine.ready()
    const rendered = await ctx.render()
    const buffer = rendered.get()
    if (!buffer) throw new Error("nothing was rendered")
    return buffer
  } finally {
    engine.dispose()
    ctx.dispose()
  }
}
