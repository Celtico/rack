import { create } from "zustand"

import { CHANNEL_IDS, type ChannelId } from "./channels"
import {
  BASS_PARAMS_DEFAULT,
  BASS_RANGES,
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  clamp,
  clampRecord,
  DRUM_LEVELS_DEFAULT,
  EP_PARAMS_DEFAULT,
  EP_RANGES,
  FX_DEFAULT,
  FX_RANGES,
  MASTER_DEFAULT,
  MIX_DEFAULT,
  PERC_LEVELS_DEFAULT,
  POLY_PARAMS_DEFAULT,
  POLY_RANGES,
  STRINGS_PARAMS_DEFAULT,
  STRINGS_RANGES,
  SYNTH_PARAMS_DEFAULT,
  SYNTH_RANGES,
  type BassParams,
  type DrumLevels,
  type EpParams,
  type FxParams,
  type MixParams,
  type PercLevels,
  type PolyParams,
  type StringsParams,
  type SynthParams,
} from "./params"
import {
  DRUM_VOICES,
  PERC_VOICES,
  toggleBassFlag,
  toggleBassNote,
  toggleDrumStep,
  togglePercStep,
  togglePolyNote,
  toggleSynthNote,
  type BassFlag,
  type DrumVoiceId,
  type Pattern,
  type PercVoiceId,
  type PolyInstrumentId,
} from "./pattern"
import { createDefaultBank, MAX_CHAIN, PATTERN_COUNT } from "./patterns"
import { SONG_VERSION, type Song } from "./song"

export * from "./params"

export interface RackState {
  bpm: number
  /** Off-beat delay, 0 (straight) to 1 (triplet feel). */
  swing: number
  playing: boolean
  /** Step currently sounding, or -1 when stopped. Published by the scheduler via Draw. */
  currentStep: number
  /** Bank slot currently sounding, or -1 when stopped. */
  playingPattern: number
  /** Bars since the transport started, or -1 when stopped. Drives the timeline. */
  playingBar: number
  masterVolume: number
  /** The bank: PATTERN_COUNT slots. */
  patterns: readonly Pattern[]
  /** Slot being edited — and played, when there is no chain. */
  activePattern: number
  /** Slots to play in order, one per bar; empty means loop the active one. */
  chain: readonly number[]
  drumLevels: DrumLevels
  percLevels: PercLevels
  synthParams: SynthParams
  bassParams: BassParams
  polyParams: PolyParams
  epParams: EpParams
  stringsParams: StringsParams
  mix: MixParams
  fx: FxParams

  setBpm: (bpm: number) => void
  setSwing: (swing: number) => void
  setPlaying: (playing: boolean) => void
  setPlayhead: (step: number, patternIndex: number, bar: number) => void
  setMasterVolume: (level: number) => void
  toggleDrumStep: (voice: DrumVoiceId, step: number) => void
  togglePercStep: (voice: PercVoiceId, step: number) => void
  toggleSynthNote: (step: number, rowIndex: number) => void
  toggleBassNote: (step: number, rowIndex: number) => void
  toggleBassFlag: (step: number, flag: BassFlag) => void
  togglePolyNote: (instrument: PolyInstrumentId, step: number, rowIndex: number) => void
  setActivePattern: (index: number) => void
  copyActivePatternTo: (index: number) => void
  appendToChain: (index: number) => void
  clearChain: () => void
  setDrumLevel: (voice: DrumVoiceId, level: number) => void
  setPercLevel: (voice: PercVoiceId, level: number) => void
  setSynthParam: <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => void
  setBassParam: <K extends keyof BassParams>(key: K, value: BassParams[K]) => void
  setPolyParam: <K extends keyof PolyParams>(key: K, value: PolyParams[K]) => void
  setEpParam: <K extends keyof EpParams>(key: K, value: EpParams[K]) => void
  setStringsParam: <K extends keyof StringsParams>(key: K, value: StringsParams[K]) => void
  setChannelLevel: (channel: ChannelId, level: number) => void
  setChannelSend: (channel: ChannelId, level: number) => void
  setFxParam: <K extends keyof FxParams>(key: K, value: FxParams[K]) => void
  loadSong: (song: Song) => void
}

/** The pattern on screen. */
export const selectPattern = (s: RackState): Pattern => {
  const p = s.patterns[s.activePattern] ?? s.patterns[0]
  if (!p) throw new Error("store: empty pattern bank")
  return p
}

const slot = (index: number) => clamp(Math.trunc(index), 0, PATTERN_COUNT - 1)

const updateActive = (state: RackState, fn: (p: Pattern) => Pattern) => ({
  patterns: state.patterns.map((p, i) => (i === state.activePattern ? fn(p) : p)),
})

type Ranges<T> = { [K in keyof T]?: { min: number; max: number } }

/** Clamp every numeric field of a params object to its declared range. */
function clampParams<T extends object>(params: T, ranges: Ranges<T>): T {
  const out = { ...params }
  for (const key of Object.keys(ranges) as (keyof T)[]) {
    const range = ranges[key]
    const value = out[key]
    if (range && typeof value === "number") {
      out[key] = clamp(value, range.min, range.max) as T[keyof T]
    }
  }
  return out
}

/**
 * Pattern bank, tempo, parameters and transport state. Pure state — it never
 * touches the audio engine; the UI forwards changes to the engine itself. The
 * scheduler reads the bank through `getState()` on every tick, so edits during
 * playback are heard on the next step.
 */
export const useRackStore = create<RackState>()((set) => ({
  bpm: BPM_DEFAULT,
  swing: 0,
  playing: false,
  currentStep: -1,
  playingPattern: -1,
  playingBar: -1,
  masterVolume: MASTER_DEFAULT,
  patterns: createDefaultBank(),
  activePattern: 0,
  chain: [],
  drumLevels: DRUM_LEVELS_DEFAULT,
  percLevels: PERC_LEVELS_DEFAULT,
  synthParams: SYNTH_PARAMS_DEFAULT,
  bassParams: BASS_PARAMS_DEFAULT,
  polyParams: POLY_PARAMS_DEFAULT,
  epParams: EP_PARAMS_DEFAULT,
  stringsParams: STRINGS_PARAMS_DEFAULT,
  mix: MIX_DEFAULT,
  fx: FX_DEFAULT,

  setBpm: (bpm) => set({ bpm: Math.round(clamp(bpm, BPM_MIN, BPM_MAX)) }),
  setSwing: (swing) => set({ swing: clamp(swing, 0, 1) }),
  setPlaying: (playing) => set({ playing }),
  setPlayhead: (currentStep, playingPattern, playingBar) =>
    set({ currentStep, playingPattern, playingBar }),
  setMasterVolume: (level) => set({ masterVolume: clamp(level, 0, 1) }),
  toggleDrumStep: (voice, step) =>
    set((state) => updateActive(state, (p) => toggleDrumStep(p, voice, step))),
  togglePercStep: (voice, step) =>
    set((state) => updateActive(state, (p) => togglePercStep(p, voice, step))),
  toggleSynthNote: (step, rowIndex) =>
    set((state) => updateActive(state, (p) => toggleSynthNote(p, step, rowIndex))),
  toggleBassNote: (step, rowIndex) =>
    set((state) => updateActive(state, (p) => toggleBassNote(p, step, rowIndex))),
  toggleBassFlag: (step, flag) =>
    set((state) => updateActive(state, (p) => toggleBassFlag(p, step, flag))),
  togglePolyNote: (instrument, step, rowIndex) =>
    set((state) => updateActive(state, (p) => togglePolyNote(p, instrument, step, rowIndex))),
  setActivePattern: (index) => set({ activePattern: slot(index) }),
  copyActivePatternTo: (index) =>
    set((state) => {
      const target = slot(index)
      const source = selectPattern(state)
      return {
        patterns: state.patterns.map((p, i) => (i === target ? source : p)),
        activePattern: target,
      }
    }),
  appendToChain: (index) =>
    set((state) =>
      state.chain.length >= MAX_CHAIN ? state : { chain: [...state.chain, slot(index)] },
    ),
  clearChain: () => set({ chain: [] }),
  setDrumLevel: (voice, level) =>
    set((state) => ({ drumLevels: { ...state.drumLevels, [voice]: clamp(level, 0, 1) } })),
  setPercLevel: (voice, level) =>
    set((state) => ({ percLevels: { ...state.percLevels, [voice]: clamp(level, 0, 1) } })),
  setSynthParam: (key, value) =>
    set((state) => ({ synthParams: { ...state.synthParams, [key]: value } })),
  setBassParam: (key, value) =>
    set((state) => ({ bassParams: { ...state.bassParams, [key]: value } })),
  setPolyParam: (key, value) =>
    set((state) => ({ polyParams: { ...state.polyParams, [key]: value } })),
  setEpParam: (key, value) => set((state) => ({ epParams: { ...state.epParams, [key]: value } })),
  setStringsParam: (key, value) =>
    set((state) => ({ stringsParams: { ...state.stringsParams, [key]: value } })),
  setChannelLevel: (channel, level) =>
    set((state) => ({
      mix: { ...state.mix, level: { ...state.mix.level, [channel]: clamp(level, 0, 1) } },
    })),
  setChannelSend: (channel, level) =>
    set((state) => ({
      mix: { ...state.mix, send: { ...state.mix.send, [channel]: clamp(level, 0, 1) } },
    })),
  setFxParam: (key, value) => set((state) => ({ fx: { ...state.fx, [key]: value } })),
  loadSong: (song) =>
    set({
      bpm: Math.round(clamp(song.bpm, BPM_MIN, BPM_MAX)),
      swing: clamp(song.swing, 0, 1),
      masterVolume: clamp(song.masterVolume, 0, 1),
      patterns: song.patterns,
      activePattern: slot(song.activePattern),
      chain: song.chain.slice(0, MAX_CHAIN).map(slot),
      drumLevels: clampRecord(DRUM_VOICES, song.drumLevels, 0, 1),
      percLevels: clampRecord(PERC_VOICES, song.percLevels, 0, 1),
      synthParams: clampParams(song.synthParams, SYNTH_RANGES),
      bassParams: clampParams(song.bassParams, BASS_RANGES),
      polyParams: clampParams(song.polyParams, POLY_RANGES),
      epParams: clampParams(song.epParams, EP_RANGES),
      stringsParams: clampParams(song.stringsParams, STRINGS_RANGES),
      mix: {
        level: clampRecord(CHANNEL_IDS, song.mix.level, 0, 1),
        send: clampRecord(CHANNEL_IDS, song.mix.send, 0, 1),
      },
      fx: clampParams(song.fx, FX_RANGES),
    }),
}))

const copyRows = <Id extends string>(
  ids: readonly Id[],
  rows: Readonly<Record<Id, readonly boolean[]>>,
): Record<Id, boolean[]> => {
  const out = {} as Record<Id, boolean[]>
  for (const id of ids) out[id] = [...rows[id]]
  return out
}

/** Snapshot of everything worth saving. */
export function toSong(state: RackState): Song {
  return {
    version: SONG_VERSION,
    bpm: state.bpm,
    swing: state.swing,
    masterVolume: state.masterVolume,
    patterns: state.patterns.map((p) => ({
      drums: copyRows(DRUM_VOICES, p.drums),
      perc: copyRows(PERC_VOICES, p.perc),
      synth: [...p.synth],
      bass: { notes: [...p.bass.notes], accent: [...p.bass.accent], slide: [...p.bass.slide] },
      poly: {
        poly: p.poly.poly.map((c) => [...c]),
        ep: p.poly.ep.map((c) => [...c]),
        strings: p.poly.strings.map((c) => [...c]),
      },
    })),
    activePattern: state.activePattern,
    chain: [...state.chain],
    drumLevels: { ...state.drumLevels },
    percLevels: { ...state.percLevels },
    synthParams: { ...state.synthParams },
    bassParams: { ...state.bassParams },
    polyParams: { ...state.polyParams },
    epParams: { ...state.epParams },
    stringsParams: { ...state.stringsParams },
    mix: { level: { ...state.mix.level }, send: { ...state.mix.send } },
    fx: { ...state.fx },
  }
}
