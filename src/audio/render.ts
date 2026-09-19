import * as Tone from "tone"

import type { Song } from "../state/song"
import { clampSong } from "../state/store"
import { AudioEngine, LIMITER_DB, MASTER_COMPRESSOR } from "./engine"

/** A song with no chain is one looping bar: export it a few times round, as it would sound. */
export const LOOP_BARS = 4
/** Room after the last bar for the reverb and delay to die away, at most. */
const MAX_TAIL_SECONDS = 8
/** The clock stops a hair before the bar line, so the bar after the last one never starts. */
const STOP_EARLY = 0.001
/**
 * Bars per offline stretch. An offline context builds every node a stretch will ever need
 * before it renders — a hat on every sixteenth is sixteen nodes a hit, thousands a minute —
 * and processes all of them on every quantum until they finish, so one long render costs the
 * square of its length: 16 bars in 20 s, 32 in over two minutes. Rendered a stretch at a time
 * and summed where the tails overlap, it is linear again.
 */
export const CHUNK_BARS = 16

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

/** The stretches a render is cut into: `[start, end)` in bars, `CHUNK_BARS` each but the last. Pure. */
export function renderChunks(bars: number, size = CHUNK_BARS): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  for (let start = 0; start < bars; start += size)
    out.push({ start, end: Math.min(bars, start + size) })
  return out
}

/** `src` added onto `dst` from `at`, as far as `dst` reaches. Pure (in place). */
export function mixInto(dst: Float32Array, src: Float32Array, at: number): void {
  const n = Math.min(src.length, dst.length - at)
  for (let i = 0; i < n; i++) dst[at + i]! += src[i]!
}

/**
 * Render a song to audio faster than real time. A second engine is built from
 * the song — not the store — in an offline context, its clock run through the
 * chain once, and the master output (compressor and limiter included)
 * returned as a buffer. The live rack is untouched and may keep playing.
 * Sampler pads read the samples stored under their instance ids, like a load
 * of that song would.
 *
 * The chain is rendered `CHUNK_BARS` at a time (see there), each stretch with
 * the tail the plan gives the whole, and the stretches summed where a tail
 * runs under the next one's first bars — the echo and reverb of one carrying
 * into the other as they would have. LFOs start each stretch at the phase they
 * had reached (`EngineSource.timeOffset`); a note held across a stretch line
 * is released and struck again there. The stretches carry the master gain but
 * not the glue: the compressor and limiter go over the summed mix once at the
 * end, so nothing is compressed twice or clipped by a sum.
 *
 * Not `Tone.Offline`: that swaps the *global* context for as long as its
 * callback runs, and this one has to wait for the reverb's impulse response
 * and the samplers' decodes — anything the live rack did meanwhile (Play, Add
 * unit, a load) would have built its nodes into the throwaway context. Here
 * the swap lasts one synchronous `build()`, and is undone even if it throws.
 */
export async function renderSong(
  raw: Song,
  onProgress?: (fraction: number) => void,
): Promise<AudioBuffer> {
  const song = clampSong(raw)
  const plan = renderPlan(song)
  const live = Tone.getContext()
  const sampleRate = live.sampleRate
  const barSeconds = 4 * (60 / song.bpm)
  const tail = plan.seconds - plan.barsSeconds
  const total = Math.ceil(plan.seconds * sampleRate)
  const mix = [new Float32Array(total), new Float32Array(total)] as const
  const chunks = renderChunks(plan.bars)

  for (const [i, chunk] of chunks.entries()) {
    const startSeconds = chunk.start * barSeconds
    const coreSeconds = (chunk.end - chunk.start) * barSeconds
    const rendered = await renderStretch(song, chunk.start, startSeconds, coreSeconds, tail)
    const at = Math.round(startSeconds * sampleRate)
    for (const channel of [0, 1] as const)
      mixInto(
        mix[channel],
        rendered.getChannelData(Math.min(channel, rendered.numberOfChannels - 1)),
        at,
      )
    onProgress?.((i + 1) / (chunks.length + 1))
  }

  const premaster = live.createBuffer(2, total, sampleRate)
  premaster.copyToChannel(mix[0], 0)
  premaster.copyToChannel(mix[1], 1)
  const mastered = await applyMaster(premaster)
  onProgress?.(1)
  return mastered
}

/** One stretch of the song, from `fromBar`: `coreSeconds` of bars, then `tail` seconds of ring-out. */
async function renderStretch(
  song: Song,
  fromBar: number,
  startSeconds: number,
  coreSeconds: number,
  tail: number,
): Promise<AudioBuffer> {
  // Solo is not part of a song: a render hears every machine.
  const state = { ...song, followSong: true, solo: {} }
  const engine = new AudioEngine({ getState: () => state, timeOffset: startSeconds })
  const live = Tone.getContext()
  const ctx = new Tone.OfflineContext(2, coreSeconds + tail, live.sampleRate)
  try {
    Tone.setContext(ctx)
    try {
      ctx.transport.bpm.value = song.bpm
      engine.build()
      engine.bypassMaster()
      // Armed here too: the sequence is a Tone node, and it must be born in this context.
      // Nothing sounds until `render()`, so starting the clock before `ready()` is fine.
      engine.run(0, fromBar)
      // A slide on the last step would hold the bass open through the whole tail.
      ctx.transport.once("stop", (time) => engine.release(time))
      ctx.transport.stop(coreSeconds - STOP_EARLY)
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

/** The master glue over a finished mix: the bus compressor, then the limiter. One pass, linear time. */
async function applyMaster(buffer: AudioBuffer): Promise<AudioBuffer> {
  const live = Tone.getContext()
  const ctx = new Tone.OfflineContext(2, buffer.duration, buffer.sampleRate)
  let source: Tone.ToneBufferSource | null = null
  let compressor: Tone.Compressor | null = null
  let limiter: Tone.Limiter | null = null
  try {
    Tone.setContext(ctx)
    try {
      limiter = new Tone.Limiter(LIMITER_DB).toDestination()
      compressor = new Tone.Compressor(MASTER_COMPRESSOR).connect(limiter)
      source = new Tone.ToneBufferSource(buffer).connect(compressor)
      source.start(0)
    } finally {
      Tone.setContext(live)
    }
    const rendered = await ctx.render()
    const out = rendered.get()
    if (!out) throw new Error("nothing was rendered")
    return out
  } finally {
    source?.dispose()
    compressor?.dispose()
    limiter?.dispose()
    ctx.dispose()
  }
}
