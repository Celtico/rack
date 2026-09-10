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
  FX_DEFAULT,
  FX_RANGES,
  MASTER_DEFAULT,
  MIX_DEFAULT,
  PERC_LEVELS_DEFAULT,
  SYNTH_PARAMS_DEFAULT,
  SYNTH_RANGES,
  type BassParams,
  type DrumLevels,
  type FxParams,
  type MixParams,
  type PercLevels,
  type SynthParams,
} from "./params"
import {
  DRUM_VOICES,
  PERC_VOICES,
  toggleBassFlag,
  toggleBassNote,
  toggleDrumStep,
  togglePercStep,
  toggleSynthNote,
  type BassFlag,
  type DrumVoiceId,
  type Pattern,
  type PercVoiceId,
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
  mix: MixParams
  fx: FxParams

  setBpm: (bpm: number) => void
  setSwing: (swing: number) => void
  setPlaying: (playing: boolean) => void
  setPlayhead: (step: number, patternIndex: number) => void
  setMasterVolume: (level: number) => void
  toggleDrumStep: (voice: DrumVoiceId, step: number) => void
  togglePercStep: (voice: PercVoiceId, step: number) => void
  toggleSynthNote: (step: number, rowIndex: number) => void
  toggleBassNote: (step: number, rowIndex: number) => void
  toggleBassFlag: (step: number, flag: BassFlag) => void
  setActivePattern: (index: number) => void
  copyActivePatternTo: (index: number) => void
  appendToChain: (index: number) => void
  clearChain: () => void
  setDrumLevel: (voice: DrumVoiceId, level: number) => void
  setPercLevel: (voice: PercVoiceId, level: number) => void
  setSynthParam: <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => void
  setBassParam: <K extends keyof BassParams>(key: K, value: BassParams[K]) => void
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
  masterVolume: MASTER_DEFAULT,
  patterns: createDefaultBank(),
  activePattern: 0,
  chain: [],
  drumLevels: DRUM_LEVELS_DEFAULT,
  percLevels: PERC_LEVELS_DEFAULT,
  synthParams: SYNTH_PARAMS_DEFAULT,
  bassParams: BASS_PARAMS_DEFAULT,
  mix: MIX_DEFAULT,
  fx: FX_DEFAULT,

  setBpm: (bpm) => set({ bpm: Math.round(clamp(bpm, BPM_MIN, BPM_MAX)) }),
  setSwing: (swing) => set({ swing: clamp(swing, 0, 1) }),
  setPlaying: (playing) => set({ playing }),
  setPlayhead: (currentStep, playingPattern) => set({ currentStep, playingPattern }),
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
      synthParams: {
        waveform: song.synthParams.waveform,
        cutoff: clamp(song.synthParams.cutoff, SYNTH_RANGES.cutoff.min, SYNTH_RANGES.cutoff.max),
        resonance: clamp(
          song.synthParams.resonance,
          SYNTH_RANGES.resonance.min,
          SYNTH_RANGES.resonance.max,
        ),
        decay: clamp(song.synthParams.decay, SYNTH_RANGES.decay.min, SYNTH_RANGES.decay.max),
      },
      bassParams: {
        waveform: song.bassParams.waveform,
        cutoff: clamp(song.bassParams.cutoff, BASS_RANGES.cutoff.min, BASS_RANGES.cutoff.max),
        resonance: clamp(
          song.bassParams.resonance,
          BASS_RANGES.resonance.min,
          BASS_RANGES.resonance.max,
        ),
        envMod: clamp(song.bassParams.envMod, BASS_RANGES.envMod.min, BASS_RANGES.envMod.max),
        decay: clamp(song.bassParams.decay, BASS_RANGES.decay.min, BASS_RANGES.decay.max),
      },
      mix: {
        level: clampRecord(CHANNEL_IDS, song.mix.level, 0, 1),
        send: clampRecord(CHANNEL_IDS, song.mix.send, 0, 1),
      },
      fx: {
        delayTime: song.fx.delayTime,
        feedback: clamp(song.fx.feedback, FX_RANGES.feedback.min, FX_RANGES.feedback.max),
        reverbDecay: clamp(
          song.fx.reverbDecay,
          FX_RANGES.reverbDecay.min,
          FX_RANGES.reverbDecay.max,
        ),
      },
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
    })),
    activePattern: state.activePattern,
    chain: [...state.chain],
    drumLevels: { ...state.drumLevels },
    percLevels: { ...state.percLevels },
    synthParams: { ...state.synthParams },
    bassParams: { ...state.bassParams },
    mix: { level: { ...state.mix.level }, send: { ...state.mix.send } },
    fx: { ...state.fx },
  }
}
