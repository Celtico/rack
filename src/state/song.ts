import { CHANNEL_IDS } from "./channels"
import {
  DELAY_TIMES,
  WAVEFORMS,
  type DrumLevels,
  type FxParams,
  type MixParams,
  type SynthParams,
} from "./params"
import { DRUM_VOICES, STEP_COUNT, SYNTH_NOTES, type Pattern } from "./pattern"
import { MAX_CHAIN, PATTERN_COUNT } from "./patterns"

export const SONG_VERSION = 1

/** Everything worth saving. Transport position and playing state are not. */
export interface Song {
  version: typeof SONG_VERSION
  bpm: number
  masterVolume: number
  patterns: Pattern[]
  activePattern: number
  chain: number[]
  drumLevels: DrumLevels
  synthParams: SynthParams
  mix: MixParams
  fx: FxParams
}

export class SongParseError extends Error {
  override name = "SongParseError"
}

const fail = (path: string, expected: string): never => {
  throw new SongParseError(`${path}: expected ${expected}`)
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

const num = (v: unknown, path: string): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fail(path, "a finite number")

const int = (v: unknown, path: string, max: number): number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < max
    ? (v as number)
    : fail(path, `an integer in [0, ${max})`)

const oneOf = <T extends string>(v: unknown, path: string, options: readonly T[]): T =>
  options.includes(v as T) ? (v as T) : fail(path, `one of ${options.join(", ")}`)

const record = (v: unknown, path: string): Record<string, unknown> =>
  isRecord(v) ? v : fail(path, "an object")

const list = (v: unknown, path: string, length?: number): unknown[] => {
  if (!Array.isArray(v)) return fail(path, "an array")
  if (length !== undefined && v.length !== length) return fail(path, `${length} items`)
  return v
}

function parsePattern(v: unknown, path: string): Pattern {
  const p = record(v, path)
  const drums = record(p.drums, `${path}.drums`)
  const row = (voice: (typeof DRUM_VOICES)[number]) =>
    list(drums[voice], `${path}.drums.${voice}`, STEP_COUNT).map((on, i) =>
      typeof on === "boolean" ? on : fail(`${path}.drums.${voice}[${i}]`, "a boolean"),
    )
  const parsedDrums = { kick: row("kick"), snare: row("snare"), clap: row("clap"), hat: row("hat") }
  const synth = list(p.synth, `${path}.synth`, STEP_COUNT).map((r, i) =>
    r === null ? null : int(r, `${path}.synth[${i}]`, SYNTH_NOTES.length),
  )
  return { drums: parsedDrums, synth }
}

function parseByKeys<K extends string>(
  v: unknown,
  path: string,
  keys: readonly K[],
  parse: (value: unknown, path: string) => number,
): Record<K, number> {
  const obj = record(v, path)
  return Object.fromEntries(keys.map((k) => [k, parse(obj[k], `${path}.${k}`)])) as Record<
    K,
    number
  >
}

/** Strict on shape, lenient on ranges — the store clamps numbers when it applies the song. */
export function parseSong(text: string): Song {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SongParseError("not valid JSON")
  }
  const s = record(raw, "song")
  if (s.version !== SONG_VERSION) fail("song.version", String(SONG_VERSION))

  const synth = record(s.synthParams, "song.synthParams")
  const mix = record(s.mix, "song.mix")
  const fx = record(s.fx, "song.fx")

  return {
    version: SONG_VERSION,
    bpm: num(s.bpm, "song.bpm"),
    masterVolume: num(s.masterVolume, "song.masterVolume"),
    patterns: list(s.patterns, "song.patterns", PATTERN_COUNT).map((p, i) =>
      parsePattern(p, `song.patterns[${i}]`),
    ),
    activePattern: int(s.activePattern, "song.activePattern", PATTERN_COUNT),
    chain: list(s.chain, "song.chain")
      .slice(0, MAX_CHAIN)
      .map((c, i) => int(c, `song.chain[${i}]`, PATTERN_COUNT)),
    drumLevels: parseByKeys(s.drumLevels, "song.drumLevels", DRUM_VOICES, num),
    synthParams: {
      waveform: oneOf(synth.waveform, "song.synthParams.waveform", WAVEFORMS),
      cutoff: num(synth.cutoff, "song.synthParams.cutoff"),
      resonance: num(synth.resonance, "song.synthParams.resonance"),
      decay: num(synth.decay, "song.synthParams.decay"),
    },
    mix: {
      level: parseByKeys(mix.level, "song.mix.level", CHANNEL_IDS, num),
      send: parseByKeys(mix.send, "song.mix.send", CHANNEL_IDS, num),
    },
    fx: {
      delayTime: oneOf(fx.delayTime, "song.fx.delayTime", DELAY_TIMES),
      feedback: num(fx.feedback, "song.fx.feedback"),
      reverbDecay: num(fx.reverbDecay, "song.fx.reverbDecay"),
    },
  }
}

export function serializeSong(song: Song): string {
  return JSON.stringify(song, null, 2)
}
