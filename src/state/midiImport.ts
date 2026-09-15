import { Midi, type Track } from "@tonejs/midi"

import { createInstance, type Instance } from "./instances"
import { BPM_MAX, BPM_MIN, clamp, FX_DEFAULT } from "./params"
import {
  BASS_NOTES,
  emptyTrack,
  POLY_NOTES,
  STEP_COUNT,
  SYNTH_NOTES,
  type Kind,
  type Pattern,
  type Track as RackTrack,
} from "./pattern"
import { MAX_CHAIN, padBank, PATTERN_COUNT } from "./patterns"
import { SONG_VERSION, type Song } from "./song"

/**
 * A standard MIDI file turned into a rack song. Notes are quantised to the
 * 16-step grid, one bar per pattern (identical bars share a slot), and every
 * track lands on the machine that fits it best. The rack's instruments have
 * eight fixed pitches each, so melodies are folded onto the nearest available
 * note — `moved` counts how many notes had to move.
 */
export interface MidiImport {
  song: Song
  /** What went where, for the user. */
  report: {
    bars: number
    tracks: { name: string; kind: Kind; notes: number }[]
    moved: number
    dropped: number
  }
}

export class MidiImportError extends Error {
  override name = "MidiImportError"
}

/** General MIDI percussion → kit voices. Anything else on channel 10 is dropped. */
const GM_DRUMS: Readonly<Record<number, [kind: "drums" | "perc", voice: string]>> = {
  35: ["drums", "kick"],
  36: ["drums", "kick"],
  37: ["perc", "rim"],
  38: ["drums", "snare"],
  39: ["drums", "clap"],
  40: ["drums", "snare"],
  41: ["perc", "tomLo"],
  42: ["drums", "hat"],
  43: ["perc", "tomLo"],
  44: ["drums", "hat"],
  45: ["perc", "tomLo"],
  46: ["drums", "hat"],
  47: ["perc", "tomHi"],
  48: ["perc", "tomHi"],
  49: ["perc", "crash"],
  50: ["perc", "tomHi"],
  51: ["perc", "shaker"],
  52: ["perc", "crash"],
  54: ["perc", "shaker"],
  55: ["perc", "crash"],
  56: ["perc", "cowbell"],
  57: ["perc", "crash"],
  59: ["perc", "shaker"],
  69: ["perc", "shaker"],
  70: ["perc", "shaker"],
  82: ["perc", "shaker"],
}

const NOTE_NUMBER: Readonly<Record<string, number>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
}

/** "Eb2" → 39 (MIDI, C4 = 60). */
export function midiOf(name: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name)
  if (!m) throw new Error(`bad note name ${name}`)
  return (Number(m[2]) + 1) * 12 + NOTE_NUMBER[m[1]!]!
}

/**
 * Row of the instrument's scale for a MIDI note: same pitch class in the
 * nearest octave when the scale has it, otherwise the nearest pitch. Returns
 * whether the note had to change pitch class.
 */
export function nearestRow(
  midi: number,
  scale: readonly number[],
): { row: number; moved: boolean } {
  let best = 0
  let bestScore = Infinity
  scale.forEach((pitch, row) => {
    const samePc = (pitch - midi) % 12 === 0
    // Pitch-class matches win by a wide margin; among them, the closest octave.
    const score = Math.abs(pitch - midi) + (samePc ? 0 : 1000)
    if (score < bestScore) {
      bestScore = score
      best = row
    }
  })
  return { row: best, moved: bestScore >= 1000 }
}

const SCALES: Readonly<Record<Exclude<Kind, "drums" | "perc" | "sampler" | "video">, number[]>> = {
  synth: SYNTH_NOTES.map(midiOf),
  bass: BASS_NOTES.map(midiOf),
  poly: POLY_NOTES.poly.map(midiOf),
  ep: POLY_NOTES.ep.map(midiOf),
  strings: POLY_NOTES.strings.map(midiOf),
}

interface Placed {
  step: number
  midi: number
  velocity: number
  /** Length in steps, at least 1. */
  length: number
}

/**
 * Which melodic machine plays a track: what the track name says, then the
 * General MIDI program (0, the default, says nothing), then range and polyphony.
 */
function kindForTrack(track: Track, notes: Placed[]): Kind {
  const program = track.instrument.number
  const name = track.name
  const median = [...notes].sort((a, b) => a.midi - b.midi)[Math.floor(notes.length / 2)]!.midi
  const chords = notes.some((n, i) => i > 0 && notes[i - 1]!.step === n.step)
  if (/\bbass\b/i.test(name)) return "bass"
  if (/\b(pad|strings?|choir|chords?)\b/i.test(name)) return "poly"
  if (/\b(guitar|pluck|harp)\b/i.test(name)) return "strings"
  if (/\b(piano|keys|rhodes|e\.?p\.?)\b/i.test(name)) return "ep"
  if (/\b(lead|synth|arp|melody)\b/i.test(name)) return chords ? "poly" : "synth"
  if ((program >= 32 && program <= 39) || median < midiOf("C2") + 6) return "bass"
  if (program >= 24 && program <= 31) return "strings"
  if (program >= 1 && program <= 7) return "ep"
  if (program >= 88 && program <= 103) return "poly"
  if (program >= 80 && program <= 87 && !chords) return "synth"
  if (!chords && median < midiOf("C3") + 12) return "synth"
  return "poly"
}

/**
 * Channel 10 is percussion by the General MIDI convention; files written in a
 * tracker or notation program often leave everything on channel 1 and say
 * "Drums" in the track name instead.
 */
const PERCUSSION_NAME = /\b(drums?|percussion|perc|kit|kick|snare|hi-?hats?|cymbals?|beat)\b/i
export const isPercussion = (track: Track): boolean =>
  track.instrument.percussion || track.channel === 9 || PERCUSSION_NAME.test(track.name)

/** Every note of a track on the grid, rests and overlaps resolved later by the kind. */
function place(track: Track, stepTicks: number, maxSteps: number): Placed[] {
  const out: Placed[] = []
  for (const n of track.notes) {
    const step = Math.round(n.ticks / stepTicks)
    if (step >= maxSteps) continue
    out.push({
      step,
      midi: n.midi,
      velocity: n.velocity,
      length: Math.max(1, Math.round(n.durationTicks / stepTicks)),
    })
  }
  return out.sort((a, b) => a.step - b.step || a.midi - b.midi)
}

type Bars = Map<number, RackTrack>

const barOf = (step: number) => Math.floor(step / STEP_COUNT)
const inBar = (step: number) => step % STEP_COUNT

function kitTrack(bars: Bars, bar: number, kind: "drums" | "perc"): RackTrack & { rows: unknown } {
  let t = bars.get(bar)
  if (!t) {
    t = structuredClone(emptyTrack(kind))
    bars.set(bar, t)
  }
  return t as RackTrack & { rows: unknown }
}

/** Convert a parsed MIDI file. Throws `MidiImportError` when nothing usable is in it. */
export function importMidi(midi: Midi): MidiImport {
  const ppq = midi.header.ppq
  const stepTicks = ppq / 4
  const maxSteps = STEP_COUNT * PATTERN_COUNT * 8 // read plenty; the chain is cut later
  const tempo = midi.header.tempos[0]?.bpm ?? 120
  const bpm = Math.round(clamp(tempo, BPM_MIN, BPM_MAX))

  const instances: Instance[] = []
  // Per instance id: its track in each bar.
  const perInstance = new Map<string, Bars>()
  const report: MidiImport["report"] = { bars: 0, tracks: [], moved: 0, dropped: 0 }
  let lastBar = -1

  const instanceFor = (kind: Kind): string => {
    const existing = instances.filter((i) => i.kind === kind)
    // Drums and perc pool every percussion track; melodic kinds get one machine per track, two at most.
    if (existing.length && (kind === "drums" || kind === "perc" || existing.length >= 2))
      return existing[0]!.id
    const inst = createInstance(kind, instances)
    instances.push(inst)
    perInstance.set(inst.id, new Map())
    return inst.id
  }

  for (const track of midi.tracks) {
    const notes = place(track, stepTicks, maxSteps)
    if (notes.length === 0) continue
    const name = track.name || track.instrument.name || `track ${midi.tracks.indexOf(track) + 1}`

    if (isPercussion(track)) {
      let used = 0
      for (const n of notes) {
        const hit = GM_DRUMS[n.midi]
        if (!hit) {
          report.dropped++
          continue
        }
        const [kind, voice] = hit
        const bars = perInstance.get(instanceFor(kind))!
        const t = kitTrack(bars, barOf(n.step), kind)
        const rows = t.rows as Record<string, boolean[]>
        rows[voice]![inBar(n.step)] = true
        lastBar = Math.max(lastBar, barOf(n.step))
        used++
      }
      if (used) report.tracks.push({ name, kind: "drums", notes: used })
      continue
    }

    const kind = kindForTrack(track, notes)
    const id = instanceFor(kind)
    const bars = perInstance.get(id)!
    const scale = SCALES[kind as keyof typeof SCALES]
    let used = 0
    for (const n of notes) {
      const { row, moved } = nearestRow(n.midi, scale)
      if (moved) report.moved++
      const bar = barOf(n.step)
      const step = inBar(n.step)
      let t = bars.get(bar)
      if (!t) {
        t = structuredClone(emptyTrack(kind))
        bars.set(bar, t)
      }
      switch (t.kind) {
        case "synth": {
          const rowsArr = t.notes as (number | null)[]
          if (rowsArr[step] !== null && rowsArr[step] !== undefined) {
            report.dropped++
            continue
          }
          rowsArr[step] = row
          break
        }
        case "bass": {
          const b = t.bass as { notes: (number | null)[]; accent: boolean[]; slide: boolean[] }
          if (b.notes[step] !== null && b.notes[step] !== undefined) {
            report.dropped++
            continue
          }
          b.notes[step] = row
          if (n.velocity > 0.8) b.accent[step] = true
          // A note longer than a step holds into the next ones: the same row with slides.
          for (let k = 1; k < n.length && step + k < STEP_COUNT; k++) {
            if (b.notes[step + k] !== null && b.notes[step + k] !== undefined) break
            b.slide[step + k - 1] = true
            b.notes[step + k] = row
          }
          break
        }
        case "poly":
        case "ep":
        case "strings": {
          const chords = t.chords as number[][]
          const column = chords[step]!
          if (!column.includes(row)) column.push(row)
          column.sort((a, b) => a - b)
          break
        }
        default:
          report.dropped++
          continue
      }
      lastBar = Math.max(lastBar, bar)
      used++
    }
    if (used) report.tracks.push({ name, kind, notes: used })
  }

  if (instances.length === 0 || lastBar < 0)
    throw new MidiImportError("no notes the rack can play were found")

  // One pattern per distinct bar, in order of first appearance; the chain replays them.
  const bars = Math.min(lastBar + 1, MAX_CHAIN)
  const slots = new Map<string, number>()
  const patterns: Pattern[] = []
  const chain: number[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tracks: Record<string, RackTrack> = {}
    for (const inst of instances)
      tracks[inst.id] = perInstance.get(inst.id)!.get(bar) ?? emptyTrack(inst.kind)
    const key = JSON.stringify(tracks)
    let slot = slots.get(key)
    if (slot === undefined) {
      if (patterns.length >= PATTERN_COUNT) break
      slot = patterns.length
      slots.set(key, slot)
      patterns.push({ tracks })
    }
    chain.push(slot)
  }
  report.bars = chain.length

  const song: Song = {
    version: SONG_VERSION,
    bpm,
    swing: 0,
    masterVolume: 0.8,
    instances,
    patterns: padBank(patterns, instances),
    activePattern: 0,
    // A single bar just loops; a chain of one would say "1 bar" and be the same thing.
    chain: chain.length > 1 ? chain : [],
    fx: { ...FX_DEFAULT },
  }
  return { song, report }
}

/** Parse the bytes of a `.mid` file and convert them. */
export function songFromMidi(bytes: ArrayBuffer): MidiImport {
  let midi: Midi
  try {
    midi = new Midi(bytes)
  } catch {
    throw new MidiImportError("not a MIDI file")
  }
  return importMidi(midi)
}
