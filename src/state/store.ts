import { create } from "zustand"

import {
  clampFilter,
  clampParams,
  createInstance,
  defaultInstances,
  defaultParams,
  hasStripFilter,
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
import { FILTER_DEFAULT, type FilterParams, type FxParams } from "./params"
import {
  emptyTrack,
  toggleBassFlag,
  toggleKitStep,
  togglePartMute,
  toggleTrackNote,
  withoutTrack,
  withTrack,
  type BassFlag,
  type Kind,
  type PadId,
  type Pattern,
  type Track,
} from "./pattern"
import {
  emptyHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from "./history"
import { FIXED_UNITS } from "./layout"
import {
  clampMod,
  defaultMod,
  macroPatches,
  type LfoParams,
  type MacroPatches,
  type MacroTarget,
  type ModParams,
  type RandomParams,
} from "./mod"
import { createDefaultBank, MAX_CHAIN, PATTERN_COUNT } from "./patterns"
import { randomFilter, randomizeInstance, randomSynthFilter } from "./random"
import { randomTrack } from "./randomPart"
import { SONG_VERSION, type Song } from "./song"

export * from "./params"
export * from "./mod"

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
  /** Machines heard on their own: while any is set, the others fall silent. UI-only, not saved. */
  solo: Readonly<Record<string, boolean>>
  /** Undo/redo of everything a song holds. Cleared by a load. */
  history: History<SongSlice>
  /** A drag-paint in progress: every edit until `endStroke` is one undo step. UI-only. */
  stroke: number | null
  /** How many songs have been loaded — the autosave tells a load from an edit by it. UI-only. */
  loads: number

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
  /** Let a machine sit out one bank slot (the one on screen by default), or play in it again. */
  togglePartMute: (id: string, slot?: number) => void
  /** Pick a slot to edit — and to loop, taking over from the song while it plays. */
  setActivePattern: (index: number) => void
  setFollowSong: (follow: boolean) => void
  copyActivePatternTo: (index: number) => void
  appendToChain: (index: number) => void
  /** One more bar of whatever the last bar plays — "again". */
  repeatLastBar: () => void
  /** The whole chain once more after itself, as far as `MAX_CHAIN` allows. */
  repeatChain: () => void
  setChainSlot: (bar: number, index: number) => void
  removeChainSlot: (bar: number) => void
  clearChain: () => void
  /** Add a machine of a kind; returns it. Its tracks start empty in every slot. */
  addInstance: (kind: Kind) => Instance
  /** Take a machine out with all its tracks; returns what it takes so it can be restored. */
  removeInstance: (id: string) => RemovedInstance | null
  restoreInstance: (removed: RemovedInstance) => void
  /**
   * Put a machine's sound and every pattern of its part onto another of the
   * same kind; the target keeps its level, send and mute. False if they differ in kind.
   */
  copyInstance: (from: string, to: string) => boolean
  /** A new machine right after `id`, with its sound, mix and every pattern of its part. */
  duplicateInstance: (id: string) => Instance | null
  /** Put a copy of `track` in bank slot `slot` of machine `id` — a paste. False if the kinds differ. */
  setTrack: (id: string, slot: number, track: Track) => boolean
  /** The machine's sound and modulation back to factory; its patterns stay. */
  resetInstanceSound: (id: string) => void
  /** A new sound at random (params, strip filter, tune, drive). `rng` is for tests. */
  randomizeInstanceSound: (id: string, rng?: () => number) => void
  /** A random part for the machine in the pattern on screen. `rng` is for tests. */
  randomizePart: (id: string, rng?: () => number) => void
  /** The machine's filter at random — its own on a synth, the strip's elsewhere. */
  randomizeFilter: (id: string, rng?: () => number) => void
  /** The machine's filter back to factory. */
  resetFilter: (id: string) => void
  setInstanceParams: (id: string, patch: Partial<KindParams[Kind]>) => void
  setInstanceLevel: (id: string, level: number) => void
  setInstanceSend: (id: string, send: number) => void
  setInstanceMute: (id: string, mute: boolean) => void
  setInstanceSolo: (id: string, solo: boolean) => void
  /** Change part of a strip filter; nothing happens on a kind whose filter is in its params. */
  setInstanceFilter: (id: string, patch: Partial<FilterParams>) => void
  /** Tune and drive. */
  setInstanceMod: (id: string, patch: Partial<Pick<ModParams, "tune" | "drive">>) => void
  setInstanceLfo: (id: string, index: 0 | 1, patch: Partial<LfoParams>) => void
  setInstanceRandom: (id: string, patch: Partial<RandomParams>) => void
  /** Turn a macro: its targets move with it. Returns what changed, for the engine; null if nothing did. */
  setMacro: (id: string, index: number, value: number) => MacroPatches | null
  setMacroTargets: (id: string, index: number, targets: MacroTarget[]) => void
  selectPad: (id: string, pad: PadId) => void
  setFxParam: <K extends keyof FxParams>(key: K, value: FxParams[K]) => void
  toggleFold: (unit: string) => void
  /** Fold or unfold every listed unit at once. */
  setFolded: (units: readonly string[], folded: boolean) => void
  loadSong: (song: Song) => void
  /** Step back through the song's edits; false when there is nothing to undo. The UI syncs the engine. */
  undo: () => boolean
  redo: () => boolean
  /** Group the edits that follow (a painted stroke across the grid) into one undo step. */
  beginStroke: () => void
  endStroke: () => void
}

/** The part of the state that is the song — what `toSong` saves and what undo restores. */
export type SongSlice = Pick<
  RackState,
  "bpm" | "swing" | "masterVolume" | "instances" | "patterns" | "activePattern" | "chain" | "fx"
>

const snapshot = (s: RackState): SongSlice => ({
  bpm: s.bpm,
  swing: s.swing,
  masterVolume: s.masterVolume,
  instances: s.instances,
  patterns: s.patterns,
  activePattern: s.activePattern,
  chain: s.chain,
  fx: s.fx,
})

/** The history with the state as it is now remembered, to spread into an edit's result. */
const remember = (state: RackState, key: string | null = null) => ({
  history:
    state.stroke === null
      ? record(state.history, snapshot(state), key, Date.now())
      : record(state.history, snapshot(state), `stroke:${state.stroke}`, Date.now(), Infinity),
})

let strokes = 0

export const selectCanUndo = (s: RackState): boolean => s.history.past.length > 0
export const selectCanRedo = (s: RackState): boolean => s.history.future.length > 0

/** The pattern on screen. */
export const selectPattern = (s: RackState): Pattern => {
  const p = s.patterns[s.activePattern] ?? s.patterns[0]
  if (!p) throw new Error("store: empty pattern bank")
  return p
}

export const selectInstance = (s: RackState, id: string): Instance | undefined =>
  s.instances.find((i) => i.id === id)

/** True while some other machine is soloed and this one is not — it is heard no more. */
export const silencedBySolo = (solo: Readonly<Record<string, boolean>>, id: string): boolean =>
  !solo[id] && Object.values(solo).some(Boolean)

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

/**
 * An instance pulled into range — and completed: songs saved in the library
 * before the strip filter and the modulation block existed come back as plain
 * objects (not through `parseSong`), so whatever they lack gets its default.
 */
const clampInstance = (inst: Instance): Instance =>
  ({
    ...inst,
    params: clampParams(inst.kind, inst.params as never),
    level: clamp(inst.level, 0, 1),
    send: clamp(inst.send, 0, 1),
    mute: inst.mute === true,
    ...(hasStripFilter(inst.kind)
      ? { filter: clampFilter({ ...FILTER_DEFAULT, ...(inst.filter ?? {}) }) }
      : {}),
    mod: clampMod(mergeMod(inst.mod)),
  }) as Instance

/** A modulation block with every missing piece filled in from the default. */
const mergeMod = (mod: Partial<ModParams> | undefined): ModParams => {
  const d = defaultMod()
  if (!mod) return d
  return {
    tune: mod.tune ?? d.tune,
    drive: mod.drive ?? d.drive,
    lfo: [
      { ...d.lfo[0], ...(mod.lfo?.[0] ?? {}) },
      { ...d.lfo[1], ...(mod.lfo?.[1] ?? {}) },
    ],
    random: { ...d.random, ...(mod.random ?? {}) },
    macros: d.macros.map((m, i) => ({
      ...m,
      ...(mod.macros?.[i] ?? {}),
      targets: [...(mod.macros?.[i]?.targets ?? m.targets)],
    })) as ModParams["macros"],
  }
}

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
  solo: {},
  history: emptyHistory(),
  stroke: null,
  loads: 0,

  setBpm: (bpm) =>
    set((state) => ({ ...remember(state, "bpm"), bpm: Math.round(clamp(bpm, BPM_MIN, BPM_MAX)) })),
  setSwing: (swing) => set((state) => ({ ...remember(state, "swing"), swing: clamp(swing, 0, 1) })),
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
  setMasterVolume: (level) =>
    set((state) => ({ ...remember(state, "master"), masterVolume: clamp(level, 0, 1) })),

  toggleStep: (id, voice, step) =>
    set((state) => ({
      ...remember(state),
      ...editActiveTrack(state, id, (t) => ("rows" in t ? toggleKitStep(t, voice, step) : t)),
    })),
  toggleNote: (id, step, rowIndex) =>
    set((state) => ({
      ...remember(state),
      ...editActiveTrack(state, id, (t) => toggleTrackNote(t, step, rowIndex)),
    })),
  toggleFlag: (id, step, flag) =>
    set((state) => ({
      ...remember(state),
      ...editActiveTrack(state, id, (t) => toggleBassFlag(t, step, flag)),
    })),

  togglePartMute: (id, index) =>
    set((state) => {
      const at = index === undefined ? state.activePattern : slot(index)
      if (!state.instances.some((i) => i.id === id)) return state
      return {
        ...remember(state),
        patterns: state.patterns.map((p, i) => (i === at ? togglePartMute(p, id) : p)),
      }
    }),
  setActivePattern: (index) => set({ activePattern: slot(index), followSong: false }),
  setFollowSong: (followSong) => set({ followSong }),
  copyActivePatternTo: (index) =>
    set((state) => {
      const target = slot(index)
      const source = selectPattern(state)
      return {
        ...remember(state),
        patterns: state.patterns.map((p, i) => (i === target ? source : p)),
        activePattern: target,
      }
    }),
  appendToChain: (index) =>
    set((state) =>
      state.chain.length >= MAX_CHAIN
        ? state
        : { ...remember(state), chain: [...state.chain, slot(index)], followSong: true },
    ),
  repeatLastBar: () =>
    set((state) => {
      const last = state.chain[state.chain.length - 1]
      return last === undefined || state.chain.length >= MAX_CHAIN
        ? state
        : { ...remember(state), chain: [...state.chain, last], followSong: true }
    }),
  repeatChain: () =>
    set((state) => {
      if (state.chain.length === 0 || state.chain.length >= MAX_CHAIN) return state
      const again = state.chain.slice(0, MAX_CHAIN - state.chain.length)
      return { ...remember(state), chain: [...state.chain, ...again], followSong: true }
    }),
  setChainSlot: (bar, index) =>
    set((state) => ({
      ...remember(state),
      chain: state.chain.map((p, i) => (i === bar ? slot(index) : p)),
    })),
  removeChainSlot: (bar) =>
    set((state) => ({ ...remember(state), chain: state.chain.filter((_, i) => i !== bar) })),
  clearChain: () => set((state) => ({ ...remember(state), chain: [] })),

  addInstance: (kind) => {
    const inst = createInstance(kind, get().instances)
    set((state) => ({
      ...remember(state),
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
    const { [id]: _solo, ...solo } = state.solo
    set({
      ...remember(state),
      instances: state.instances.filter((i) => i.id !== id),
      patterns: state.patterns.map((p) => withoutTrack(p, id)),
      solo,
    })
    return { instance, tracks, index }
  },
  restoreInstance: ({ instance, tracks, index }) =>
    set((state) => {
      if (state.instances.some((i) => i.id === instance.id)) return state
      const instances = [...state.instances]
      instances.splice(Math.min(index, instances.length), 0, instance)
      return {
        ...remember(state),
        instances,
        patterns: state.patterns.map((p, i) =>
          withTrack(p, instance.id, tracks[i] ?? emptyTrack(instance.kind)),
        ),
      }
    }),
  copyInstance: (from, to) => {
    const state = get()
    const source = state.instances.find((i) => i.id === from)
    const target = state.instances.find((i) => i.id === to)
    if (!source || !target || from === to || source.kind !== target.kind) return false
    set({
      ...remember(state),
      instances: state.instances.map((i) =>
        i.id === to ? ({ ...i, params: structuredClone(source.params) } as Instance) : i,
      ),
      patterns: state.patterns.map((p) => {
        const track = p.tracks[from]
        return track ? withTrack(p, to, copyTrack(track)) : p
      }),
    })
    return true
  },
  duplicateInstance: (id) => {
    const state = get()
    const index = state.instances.findIndex((i) => i.id === id)
    const source = state.instances[index]
    if (!source) return null
    const inst = {
      ...createInstance(source.kind, state.instances),
      params: structuredClone(source.params),
      level: source.level,
      send: source.send,
      mute: source.mute,
    } as Instance
    const instances = [...state.instances]
    instances.splice(index + 1, 0, inst)
    set({
      ...remember(state),
      instances,
      patterns: state.patterns.map((p) => {
        const track = p.tracks[id]
        return withTrack(p, inst.id, track ? copyTrack(track) : emptyTrack(source.kind))
      }),
    })
    return inst
  },
  resetInstanceSound: (id) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(
        state,
        id,
        (i) =>
          ({
            ...i,
            params: defaultParams(i.kind),
            ...(hasStripFilter(i.kind) ? { filter: { ...FILTER_DEFAULT } } : {}),
            mod: defaultMod(),
          }) as Instance,
      ),
    })),
  randomizeInstanceSound: (id, rng = Math.random) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(state, id, (i) => clampInstance(randomizeInstance(i, rng))),
    })),
  randomizeFilter: (id, rng = Math.random) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(state, id, (i) => {
        if (i.filter) return { ...i, filter: clampFilter(randomFilter(rng)) }
        if (i.kind === "synth" || i.kind === "bass" || i.kind === "poly") {
          return {
            ...i,
            params: clampParams(i.kind, { ...i.params, ...randomSynthFilter(i.kind, rng) }),
          } as Instance
        }
        return i
      }),
    })),
  resetFilter: (id) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(state, id, (i) => {
        if (i.filter) return { ...i, filter: { ...FILTER_DEFAULT } }
        if (i.kind === "synth" || i.kind === "bass" || i.kind === "poly") {
          const d = defaultParams(i.kind)
          return {
            ...i,
            params: {
              ...i.params,
              filterType: d.filterType,
              cutoff: d.cutoff,
              resonance: d.resonance,
            },
          } as Instance
        }
        return i
      }),
    })),
  randomizePart: (id, rng = Math.random) =>
    set((state) => ({
      ...remember(state),
      ...editActiveTrack(state, id, (t) => randomTrack(t.kind, rng)),
    })),
  setTrack: (id, index, track) => {
    const state = get()
    const target = state.instances.find((i) => i.id === id)
    if (!target || target.kind !== track.kind) return false
    const at = slot(index)
    set({
      ...remember(state),
      patterns: state.patterns.map((p, i) => (i === at ? withTrack(p, id, copyTrack(track)) : p)),
    })
    return true
  },
  setInstanceParams: (id, patch) =>
    set((state) => ({
      // One knob's turn is one step: coalesced by instance and the keys the patch carries.
      ...remember(state, `params:${id}:${Object.keys(patch).join(",")}`),
      ...editInstance(
        state,
        id,
        (i) =>
          ({
            ...i,
            params: clampParams(i.kind, { ...(i.params as object), ...patch } as never),
          }) as Instance,
      ),
    })),
  setInstanceLevel: (id, level) =>
    set((state) => ({
      ...remember(state, `level:${id}`),
      ...editInstance(state, id, (i) => ({ ...i, level: clamp(level, 0, 1) })),
    })),
  setInstanceSend: (id, send) =>
    set((state) => ({
      ...remember(state, `send:${id}`),
      ...editInstance(state, id, (i) => ({ ...i, send: clamp(send, 0, 1) })),
    })),
  setInstanceMute: (id, mute) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(state, id, (i) => ({ ...i, mute })),
    })),
  setInstanceFilter: (id, patch) =>
    set((state) => {
      const inst = state.instances.find((i) => i.id === id)
      if (!inst?.filter) return state
      return {
        ...remember(state, `filter:${id}:${Object.keys(patch).join(",")}`),
        ...editInstance(state, id, (i) => ({
          ...i,
          filter: clampFilter({ ...i.filter!, ...patch }),
        })),
      }
    }),
  setInstanceMod: (id, patch) =>
    set((state) => ({
      ...remember(state, `mod:${id}:${Object.keys(patch).join(",")}`),
      ...editInstance(state, id, (i) => ({ ...i, mod: clampMod({ ...i.mod, ...patch }) })),
    })),
  setInstanceLfo: (id, index, patch) =>
    set((state) => ({
      ...remember(state, `lfo:${id}:${index}:${Object.keys(patch).join(",")}`),
      ...editInstance(state, id, (i) => {
        const lfo = [...i.mod.lfo] as ModParams["lfo"]
        lfo[index] = { ...lfo[index], ...patch }
        return { ...i, mod: clampMod({ ...i.mod, lfo }) }
      }),
    })),
  setInstanceRandom: (id, patch) =>
    set((state) => ({
      ...remember(state, `random:${id}:${Object.keys(patch).join(",")}`),
      ...editInstance(state, id, (i) => ({
        ...i,
        mod: clampMod({ ...i.mod, random: { ...i.mod.random, ...patch } }),
      })),
    })),
  setMacro: (id, index, value) => {
    const state = get()
    const inst = state.instances.find((i) => i.id === id)
    const macro = inst?.mod.macros[index]
    if (!inst || !macro) return null
    const patches = macroPatches(macro, clamp(value, 0, 1))
    set({
      ...remember(state, `macro:${id}:${index}`),
      ...editInstance(state, id, (i) => {
        const macros = [...i.mod.macros] as ModParams["macros"]
        macros[index] = { ...macro, value: clamp(value, 0, 1) }
        return {
          ...i,
          params: clampParams(i.kind, { ...(i.params as object), ...patches.params } as never),
          ...(i.filter ? { filter: clampFilter({ ...i.filter, ...patches.filter }) } : {}),
          mod: clampMod({ ...i.mod, ...patches.mod, macros }),
        } as Instance
      }),
    })
    return patches
  },
  setMacroTargets: (id, index, targets) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(state, id, (i) => {
        const macros = [...i.mod.macros] as ModParams["macros"]
        const macro = macros[index]
        if (!macro) return i
        macros[index] = { ...macro, targets }
        return { ...i, mod: clampMod({ ...i.mod, macros }) }
      }),
    })),
  setInstanceSolo: (id, solo) =>
    set((state) => {
      if (!state.instances.some((i) => i.id === id)) return state
      const { [id]: _was, ...rest } = state.solo
      return { solo: solo ? { ...rest, [id]: true } : rest }
    }),
  selectPad: (id, pad) => set((state) => ({ selectedPad: { ...state.selectedPad, [id]: pad } })),

  setFxParam: (key, value) =>
    set((state) => ({ ...remember(state, `fx:${key}`), fx: { ...state.fx, [key]: value } })),
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
        // Solo is a moment's thing: a new song starts with everything heard, and with no past to undo.
        solo: {},
        history: emptyHistory(),
        loads: state.loads + 1,
        // Every machine the song uses opens up; fixed units keep their fold state.
        folded: Object.fromEntries(
          Object.entries(state.folded).filter(([id]) => !song.instances.some((i) => i.id === id)),
        ),
      }
    }),

  undo: () => {
    const state = get()
    const step = undoHistory(state.history, snapshot(state))
    if (!step) return false
    set({ ...step.snap, history: step.history })
    return true
  },
  redo: () => {
    const state = get()
    const step = redoHistory(state.history, snapshot(state), Date.now())
    if (!step) return false
    set({ ...step.snap, history: step.history })
    return true
  },
  beginStroke: () => set({ stroke: ++strokes }),
  endStroke: () => set({ stroke: null }),
}))

/** A deep copy of a track, so a paste or a snapshot never shares arrays with the bank. */
export const copyTrack = (t: Track): Track => {
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
      (i) =>
        ({
          ...i,
          params: structuredClone(i.params),
          ...(i.filter ? { filter: { ...i.filter } } : {}),
          mod: structuredClone(i.mod),
        }) as Instance,
    ),
    patterns: state.patterns.map((p) => ({
      tracks: Object.fromEntries(Object.entries(p.tracks).map(([id, t]) => [id, copyTrack(t)])),
      ...(p.muted?.length ? { muted: [...p.muted] } : {}),
    })),
    activePattern: state.activePattern,
    chain: [...state.chain],
    fx: { ...state.fx },
  }
}
