import { create } from "zustand"

import {
  clampParams,
  createInstance,
  defaultInstances,
  type Instance,
  type KindParams,
} from "./instances"
import {
  BPM_DEFAULT,
  BPM_MAX,
  BPM_MIN,
  clamp,
  FX_DEFAULT,
  FX_RANGES,
  MASTER_DEFAULT,
} from "./params"
import type { FxParams } from "./params"
import {
  emptyTrack,
  toggleBassFlag,
  toggleKitStep,
  toggleTrackNote,
  withoutTrack,
  withTrack,
  type BassFlag,
  type Kind,
  type PadId,
  type Pattern,
  type Track,
} from "./pattern"
import { FIXED_UNITS } from "./layout"
import { createDefaultBank, MAX_CHAIN, PATTERN_COUNT } from "./patterns"
import { SONG_VERSION, type Song } from "./song"

export * from "./params"

/** Everything needed to put a removed instance back exactly where it was. */
export interface RemovedInstance {
  instance: Instance
  /** Its track in each bank slot. */
  tracks: readonly Track[]
  /** Position in the instance list. */
  index: number
}

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
  /** Slot being edited — and played, when there is no chain. With a chain playing, it follows the sounding bar. */
  activePattern: number
  /** Slots to play in order, one per bar; empty means loop the active one. */
  chain: readonly number[]
  /**
   * True: the chain plays and the active slot follows it. False: the active
   * slot loops on its own (picked from the bank while the song ran) until the
   * song is resumed. UI-only.
   */
  followSong: boolean
  /** The machines in the rack, in creation order. */
  instances: readonly Instance[]
  /** Pad whose controls each SMP-8 shows, by instance id. */
  selectedPad: Readonly<Record<string, PadId>>
  fx: FxParams
  /** Units folded down to their header. UI-only, not saved. */
  folded: Readonly<Record<string, boolean>>

  setBpm: (bpm: number) => void
  setSwing: (swing: number) => void
  setPlaying: (playing: boolean) => void
  setPlayhead: (step: number, patternIndex: number, bar: number) => void
  setMasterVolume: (level: number) => void
  /** Flip one step of one voice on a kit instance, in the active pattern. */
  toggleStep: (id: string, voice: string, step: number) => void
  /** Toggle a note on a melodic instance, in the active pattern. */
  toggleNote: (id: string, step: number, rowIndex: number) => void
  /** Flip a BASS-2 accent or slide. */
  toggleFlag: (id: string, step: number, flag: BassFlag) => void
  /** Pick a slot to edit — and to loop, taking over from the song while it plays. */
  setActivePattern: (index: number) => void
  setFollowSong: (follow: boolean) => void
  copyActivePatternTo: (index: number) => void
  appendToChain: (index: number) => void
  setChainSlot: (bar: number, index: number) => void
  removeChainSlot: (bar: number) => void
  clearChain: () => void
  /** Add a machine of a kind; returns it. Its tracks start empty in every slot. */
  addInstance: (kind: Kind) => Instance
  /** Take a machine out with all its tracks; returns what it takes so it can be restored. */
  removeInstance: (id: string) => RemovedInstance | null
  restoreInstance: (removed: RemovedInstance) => void
  setInstanceParams: (id: string, patch: Partial<KindParams[Kind]>) => void
  setInstanceLevel: (id: string, level: number) => void
  setInstanceSend: (id: string, send: number) => void
  setInstanceMute: (id: string, mute: boolean) => void
  selectPad: (id: string, pad: PadId) => void
  setFxParam: <K extends keyof FxParams>(key: K, value: FxParams[K]) => void
  toggleFold: (unit: string) => void
  /** Fold or unfold every listed unit at once. */
  setFolded: (units: readonly string[], folded: boolean) => void
  loadSong: (song: Song) => void
}

/** The pattern on screen. */
export const selectPattern = (s: RackState): Pattern => {
  const p = s.patterns[s.activePattern] ?? s.patterns[0]
  if (!p) throw new Error("store: empty pattern bank")
  return p
}

export const selectInstance = (s: RackState, id: string): Instance | undefined =>
  s.instances.find((i) => i.id === id)

/** An instance's track in the pattern on screen. */
export const selectTrack = (s: RackState, id: string): Track | undefined =>
  selectPattern(s).tracks[id]

const slot = (index: number) => clamp(Math.trunc(index), 0, PATTERN_COUNT - 1)

const editActiveTrack = (state: RackState, id: string, fn: (t: Track) => Track) => ({
  patterns: state.patterns.map((p, i) => {
    if (i !== state.activePattern) return p
    const track = p.tracks[id]
    return track ? withTrack(p, id, fn(track)) : p
  }),
})

const editInstance = (state: RackState, id: string, fn: (i: Instance) => Instance) => ({
  instances: state.instances.map((i) => (i.id === id ? fn(i) : i)),
})

const clampFx = (fx: FxParams): FxParams => ({
  delayTime: fx.delayTime,
  feedback: clamp(fx.feedback, FX_RANGES.feedback.min, FX_RANGES.feedback.max),
  reverbDecay: clamp(fx.reverbDecay, FX_RANGES.reverbDecay.min, FX_RANGES.reverbDecay.max),
})

const clampInstance = (inst: Instance): Instance =>
  ({
    ...inst,
    params: clampParams(inst.kind, inst.params as never),
    level: clamp(inst.level, 0, 1),
    send: clamp(inst.send, 0, 1),
  }) as Instance

/**
 * A song with every number pulled into range — what `loadSong` applies, and
 * what an offline render must build from: `parseSong` is lenient on ranges,
 * and a value like a zero reverb decay throws inside Tone.
 */
export const clampSong = (song: Song): Song => ({
  ...song,
  bpm: Math.round(clamp(song.bpm, BPM_MIN, BPM_MAX)),
  swing: clamp(song.swing, 0, 1),
  masterVolume: clamp(song.masterVolume, 0, 1),
  instances: song.instances.map(clampInstance),
  activePattern: slot(song.activePattern),
  chain: song.chain.slice(0, MAX_CHAIN).map(slot),
  fx: clampFx(song.fx),
})

const initialInstances = defaultInstances()

/** Fold keys of the top panel's sections — they take part in Fold all / Unfold all. */
export const MASTER_SECTIONS = ["CLOCK", "PATTERN", "SONG"] as const
export type MasterSectionId = (typeof MASTER_SECTIONS)[number]
/** The ones that start folded; the clock itself stays open. */
const MASTER_FOLDABLE: readonly MasterSectionId[] = ["PATTERN", "SONG"]

/** Every unit folded — the rack opens as a compact stack of headers. */
export const foldedAll = (ids: readonly string[]): Record<string, boolean> =>
  Object.fromEntries([...MASTER_FOLDABLE, ...FIXED_UNITS, ...ids].map((id) => [id, true]))

/**
 * Pattern bank, tempo, instances and transport state. Pure state — it never
 * touches the audio engine; the UI forwards changes to the engine itself. The
 * scheduler reads the bank through `getState()` on every tick, so edits during
 * playback are heard on the next step.
 */
export const useRackStore = create<RackState>()((set, get) => ({
  bpm: BPM_DEFAULT,
  swing: 0,
  playing: false,
  currentStep: -1,
  playingPattern: -1,
  playingBar: -1,
  masterVolume: MASTER_DEFAULT,
  patterns: createDefaultBank(initialInstances),
  activePattern: 0,
  chain: [],
  followSong: true,
  instances: initialInstances,
  selectedPad: {},
  fx: FX_DEFAULT,
  folded: foldedAll(initialInstances.map((i) => i.id)),

  setBpm: (bpm) => set({ bpm: Math.round(clamp(bpm, BPM_MIN, BPM_MAX)) }),
  setSwing: (swing) => set({ swing: clamp(swing, 0, 1) }),
  setPlaying: (playing) => set({ playing }),
  setPlayhead: (currentStep, playingPattern, playingBar) =>
    set((state) => ({
      currentStep,
      playingPattern,
      playingBar,
      // While a song plays, the grids follow the bar being heard: the slot on screen is the sounding one.
      ...(playingPattern >= 0 && state.followSong && state.chain.length > 0
        ? { activePattern: playingPattern }
        : {}),
    })),
  setMasterVolume: (level) => set({ masterVolume: clamp(level, 0, 1) }),

  toggleStep: (id, voice, step) =>
    set((state) =>
      editActiveTrack(state, id, (t) => ("rows" in t ? toggleKitStep(t, voice, step) : t)),
    ),
  toggleNote: (id, step, rowIndex) =>
    set((state) => editActiveTrack(state, id, (t) => toggleTrackNote(t, step, rowIndex))),
  toggleFlag: (id, step, flag) =>
    set((state) => editActiveTrack(state, id, (t) => toggleBassFlag(t, step, flag))),

  setActivePattern: (index) => set({ activePattern: slot(index), followSong: false }),
  setFollowSong: (followSong) => set({ followSong }),
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
      state.chain.length >= MAX_CHAIN
        ? state
        : { chain: [...state.chain, slot(index)], followSong: true },
    ),
  setChainSlot: (bar, index) =>
    set((state) => ({ chain: state.chain.map((p, i) => (i === bar ? slot(index) : p)) })),
  removeChainSlot: (bar) => set((state) => ({ chain: state.chain.filter((_, i) => i !== bar) })),
  clearChain: () => set({ chain: [] }),

  addInstance: (kind) => {
    const inst = createInstance(kind, get().instances)
    set((state) => ({
      instances: [...state.instances, inst],
      patterns: state.patterns.map((p) => withTrack(p, inst.id, emptyTrack(kind))),
    }))
    return inst
  },
  removeInstance: (id) => {
    const state = get()
    const index = state.instances.findIndex((i) => i.id === id)
    const instance = state.instances[index]
    if (!instance) return null
    const tracks = state.patterns.map((p) => p.tracks[id] ?? emptyTrack(instance.kind))
    set({
      instances: state.instances.filter((i) => i.id !== id),
      patterns: state.patterns.map((p) => withoutTrack(p, id)),
    })
    return { instance, tracks, index }
  },
  restoreInstance: ({ instance, tracks, index }) =>
    set((state) => {
      if (state.instances.some((i) => i.id === instance.id)) return state
      const instances = [...state.instances]
      instances.splice(Math.min(index, instances.length), 0, instance)
      return {
        instances,
        patterns: state.patterns.map((p, i) =>
          withTrack(p, instance.id, tracks[i] ?? emptyTrack(instance.kind)),
        ),
      }
    }),
  setInstanceParams: (id, patch) =>
    set((state) =>
      editInstance(
        state,
        id,
        (i) =>
          ({
            ...i,
            params: clampParams(i.kind, { ...(i.params as object), ...patch } as never),
          }) as Instance,
      ),
    ),
  setInstanceLevel: (id, level) =>
    set((state) => editInstance(state, id, (i) => ({ ...i, level: clamp(level, 0, 1) }))),
  setInstanceSend: (id, send) =>
    set((state) => editInstance(state, id, (i) => ({ ...i, send: clamp(send, 0, 1) }))),
  setInstanceMute: (id, mute) => set((state) => editInstance(state, id, (i) => ({ ...i, mute }))),
  selectPad: (id, pad) => set((state) => ({ selectedPad: { ...state.selectedPad, [id]: pad } })),

  setFxParam: (key, value) => set((state) => ({ fx: { ...state.fx, [key]: value } })),
  toggleFold: (unit) =>
    set((state) => ({ folded: { ...state.folded, [unit]: !state.folded[unit] } })),
  setFolded: (units, folded) =>
    set((state) => ({
      folded: { ...state.folded, ...Object.fromEntries(units.map((u) => [u, folded])) },
    })),

  loadSong: (raw) =>
    set((state) => {
      const song = clampSong(raw)
      return {
        bpm: song.bpm,
        swing: song.swing,
        masterVolume: song.masterVolume,
        instances: song.instances,
        patterns: song.patterns,
        activePattern: song.activePattern,
        chain: song.chain,
        fx: song.fx,
        selectedPad: {},
        // Every machine the song uses opens up; fixed units keep their fold state.
        folded: Object.fromEntries(
          Object.entries(state.folded).filter(([id]) => !song.instances.some((i) => i.id === id)),
        ),
      }
    }),
}))

const copyTrack = (t: Track): Track => {
  switch (t.kind) {
    case "drums":
    case "perc":
    case "sampler":
      return { kind: t.kind, rows: structuredClone(t.rows) } as Track
    case "synth":
      return { kind: t.kind, notes: [...t.notes] }
    case "bass":
      return {
        kind: t.kind,
        bass: { notes: [...t.bass.notes], accent: [...t.bass.accent], slide: [...t.bass.slide] },
      }
    case "poly":
    case "ep":
    case "strings":
      return { kind: t.kind, chords: t.chords.map((c) => [...c]) }
  }
}

/** Snapshot of everything worth saving. */
export function toSong(state: RackState): Song {
  return {
    version: SONG_VERSION,
    bpm: state.bpm,
    swing: state.swing,
    masterVolume: state.masterVolume,
    instances: state.instances.map(
      (i) => ({ ...i, params: structuredClone(i.params) }) as Instance,
    ),
    patterns: state.patterns.map((p) => ({
      tracks: Object.fromEntries(Object.entries(p.tracks).map(([id, t]) => [id, copyTrack(t)])),
    })),
    activePattern: state.activePattern,
    chain: [...state.chain],
    fx: { ...state.fx },
  }
}
