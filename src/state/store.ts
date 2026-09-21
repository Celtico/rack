import { create } from "zustand"

import {
  clampFilter,
  clampInstanceKey,
  clampParams,
  clampSpace,
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
  PAN_RANGE,
} from "./params"
import { FILTER_DEFAULT, type FilterParams, type FxParams, type SpaceParams } from "./params"
import { clampKey, type KeyParams } from "./key"
import {
  emptyTrack,
  isMelodicKind,
  KEY_DEFAULT,
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
import { createDefaultBank, MAX_CHAIN, PATTERN_COUNT, swapSlots } from "./patterns"
import {
  fitSections,
  grownLast,
  layOut,
  sectionName,
  sectionSpans,
  withoutBar,
  type Section,
} from "./sections"
import { randomFilter, randomizeInstance, randomSynthFilter } from "./random"
import { randomTrack } from "./randomPart"
import { SONG_VERSION, type Song } from "./song"

export * from "./params"
export * from "./mod"

/** Everything needed to put a removed instance back exactly where it was. */
interface RemovedInstance {
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
  /** Named runs of bars over the chain, covering it exactly (`sections.ts`); empty for a song without them. */
  sections: readonly Section[]
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
  /** Two bank slots change places; the chain and the slot on screen follow, so nothing sounds different. */
  swapPatterns: (a: number, b: number) => void
  /** Slot `to` becomes a copy of slot `from` (its parts and who sits it out). */
  copyPattern: (from: number, to: number) => void
  /** Every part of a slot emptied (who sits it out is kept) — a pattern dropped on the bank's surface. */
  clearPattern: (index: number) => void
  /** A machine's part emptied in every slot — its row dropped on the bank's surface. One undo step. */
  /** One machine's part in one bank slot back to nothing (who sits out is kept). */
  clearPart: (id: string, slot: number) => void
  appendToChain: (index: number) => void
  /** One more bar of whatever the last bar plays — "again". */
  repeatLastBar: () => void
  /** The whole chain once more after itself, as far as `MAX_CHAIN` allows. */
  repeatChain: () => void
  setChainSlot: (bar: number, index: number) => void
  removeChainSlot: (bar: number) => void
  clearChain: () => void
  /**
   * `bars` more bars of `pattern` (the slot on screen by default) at the end of the song, as a named
   * section. Bars the song already had without sections become one called "Part 1" first.
   */
  addSection: (name: string, bars: number, pattern?: number) => void
  /** A section and its bars out of the song. */
  removeSection: (index: number) => void
  renameSection: (index: number, name: string) => void
  /** A section made `bars` long: grown by repeating its last bar, or cut at the end. */
  setSectionBars: (index: number, bars: number) => void
  /** Every bar of a section on `pattern`. */
  fillSection: (index: number, pattern: number) => void
  /** A copy of a section (bars included) right after it, as far as `MAX_CHAIN` allows. */
  duplicateSection: (index: number) => void
  /** A section and its bars one place up (-1) or down (+1) the song. */
  moveSection: (index: number, direction: -1 | 1) => void
  /** The song replaced by a structure's sections, every bar on `pattern` (the slot on screen by default). */
  applyStructure: (structure: readonly Section[], pattern?: number) => void
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
  /** Stereo position, −1…1. */
  setInstancePan: (id: string, pan: number) => void
  /** Where the machine sits in 3D mode. */
  setInstanceSpace: (id: string, patch: Partial<SpaceParams>) => void
  setInstanceMute: (id: string, mute: boolean) => void
  setInstanceSolo: (id: string, solo: boolean) => void
  /**
   * Change part of a melodic machine's key (root, scale, octave): its rows become that key's notes,
   * every lit cell now sounding the new note of its row. A machine still on its fixed rows starts
   * from `KEY_DEFAULT`. Nothing happens on a kind without notes.
   */
  setInstanceKey: (id: string, patch: Partial<KeyParams>) => void
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
  | "bpm"
  | "swing"
  | "masterVolume"
  | "instances"
  | "patterns"
  | "activePattern"
  | "chain"
  | "sections"
  | "fx"
>

const snapshot = (s: RackState): SongSlice => ({
  bpm: s.bpm,
  swing: s.swing,
  masterVolume: s.masterVolume,
  instances: s.instances,
  patterns: s.patterns,
  activePattern: s.activePattern,
  chain: s.chain,
  sections: s.sections,
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

/** The machine with this id — the one place the list is searched by id (the engine's state too). */
export const selectInstance = (s: Pick<RackState, "instances">, id: string): Instance | undefined =>
  s.instances.find((i) => i.id === id)

/** True while some other machine is soloed and this one is not — it is heard no more. */
export const silencedBySolo = (solo: Readonly<Record<string, boolean>>, id: string): boolean =>
  !solo[id] && Object.values(solo).some(Boolean)

/** An instance's track in the pattern on screen. */
export const selectTrack = (s: RackState, id: string): Track | undefined =>
  selectPattern(s).tracks[id]

const slot = (index: number) => clamp(Math.trunc(index), 0, PATTERN_COUNT - 1)

/** Kinds whose filter lives in their params (the strip filter serves the rest). */
const OWN_FILTER_KINDS: readonly Kind[] = ["synth", "bass", "poly", "video", "mic"]
const hasOwnFilter = (kind: Kind): kind is "synth" | "bass" | "poly" | "video" | "mic" =>
  OWN_FILTER_KINDS.includes(kind)

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
  // Songs from before the switches have neither: off, as they sounded.
  pingPong: fx.pingPong === true,
  space: fx.space === true,
})

/**
 * An instance pulled into range — and completed: songs saved in the library
 * before the strip filter and the modulation block existed come back as plain
 * objects (not through `parseSong`), so whatever they lack gets its default.
 */
const clampInstance = ({ key, ...inst }: Instance): Instance =>
  ({
    ...inst,
    ...withKey(clampInstanceKey(inst.kind, key)),
    params: clampParams(inst.kind, inst.params as never),
    level: clamp(inst.level, 0, 1),
    send: clamp(inst.send, 0, 1),
    mute: inst.mute === true,
    pan: clamp(inst.pan ?? 0, PAN_RANGE.min, PAN_RANGE.max),
    space: clampSpace(inst.space),
    ...(hasStripFilter(inst.kind)
      ? { filter: clampFilter({ ...FILTER_DEFAULT, ...(inst.filter ?? {}) }) }
      : {}),
    mod: clampMod(mergeMod(inst.mod)),
  }) as Instance

/** `{ key }` when there is one — a machine without a key keeps the field out, not `undefined`. */
const withKey = (key: KeyParams | undefined): { key?: KeyParams } =>
  key ? { key: { ...key } } : {}

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
  // Songs kept in the browser's library before sections existed have none of the field at all.
  sections: fitSections(song.sections ?? [], Math.min(song.chain.length, MAX_CHAIN)),
  fx: clampFx(song.fx),
})

const initialInstances = defaultInstances()

/** Fold keys of the top panel's sections — they take part in Fold all / Unfold all. */
export const MASTER_SECTIONS = ["CLOCK", "PATTERN", "SONG"] as const
type MasterSectionId = (typeof MASTER_SECTIONS)[number]
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
  sections: [],
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
  swapPatterns: (a, b) =>
    set((state) => {
      const [from, to] = [slot(a), slot(b)]
      if (from === to) return state
      const patterns = [...state.patterns]
      ;[patterns[from], patterns[to]] = [patterns[to]!, patterns[from]!]
      const follow = (s: number) => (s === from ? to : s === to ? from : s)
      return {
        ...remember(state),
        patterns,
        chain: swapSlots(state.chain, from, to),
        activePattern: follow(state.activePattern),
      }
    }),
  clearPattern: (index) =>
    set((state) => {
      const at = slot(index)
      return {
        ...remember(state),
        patterns: state.patterns.map((p, i) =>
          i === at
            ? state.instances.reduce((q, inst) => withTrack(q, inst.id, emptyTrack(inst.kind)), p)
            : p,
        ),
      }
    }),
  clearPart: (id, index) =>
    set((state) => {
      const inst = selectInstance(state, id)
      const pattern = state.patterns[slot(index)]
      if (!inst || !pattern) return state
      return {
        ...remember(state),
        patterns: state.patterns.map((p) =>
          p === pattern ? withTrack(p, id, emptyTrack(inst.kind)) : p,
        ),
      }
    }),
  copyPattern: (from, to) =>
    set((state) => {
      const [source, target] = [slot(from), slot(to)]
      if (source === target) return state
      return {
        ...remember(state),
        patterns: state.patterns.map((p, i) => (i === target ? state.patterns[source]! : p)),
      }
    }),
  appendToChain: (index) =>
    set((state) =>
      state.chain.length >= MAX_CHAIN
        ? state
        : {
            ...remember(state),
            chain: [...state.chain, slot(index)],
            sections: grownLast(state.sections, 1),
            followSong: true,
          },
    ),
  repeatLastBar: () =>
    set((state) => {
      const last = state.chain[state.chain.length - 1]
      return last === undefined || state.chain.length >= MAX_CHAIN
        ? state
        : {
            ...remember(state),
            chain: [...state.chain, last],
            sections: grownLast(state.sections, 1),
            followSong: true,
          }
    }),
  repeatChain: () =>
    set((state) => {
      if (state.chain.length === 0 || state.chain.length >= MAX_CHAIN) return state
      const again = state.chain.slice(0, MAX_CHAIN - state.chain.length)
      const chain = [...state.chain, ...again]
      return {
        ...remember(state),
        chain,
        sections: fitSections([...state.sections, ...state.sections], chain.length),
        followSong: true,
      }
    }),
  setChainSlot: (bar, index) =>
    set((state) => ({
      ...remember(state),
      chain: state.chain.map((p, i) => (i === bar ? slot(index) : p)),
    })),
  removeChainSlot: (bar) =>
    set((state) => ({
      ...remember(state),
      chain: state.chain.filter((_, i) => i !== bar),
      sections: withoutBar(state.sections, bar),
    })),
  clearChain: () => set((state) => ({ ...remember(state), chain: [], sections: [] })),

  addSection: (name, bars, pattern) =>
    set((state) => {
      const count = clamp(Math.trunc(bars), 1, MAX_CHAIN - state.chain.length)
      if (count <= 0) return state
      const at = slot(pattern ?? state.activePattern)
      // Bars the song had without any section get one, so the new section is not the first thing named.
      const before =
        state.sections.length === 0 && state.chain.length > 0
          ? [{ name: "Part 1", bars: state.chain.length }]
          : state.sections
      return {
        ...remember(state),
        chain: [...state.chain, ...Array.from({ length: count }, () => at)],
        sections: [
          ...before,
          { name: sectionName(name) || `Part ${before.length + 1}`, bars: count },
        ],
        followSong: true,
      }
    }),
  removeSection: (index) =>
    set((state) => {
      const span = sectionSpans(state.sections)[index]
      if (!span) return state
      return {
        ...remember(state),
        chain: state.chain.filter((_, bar) => bar < span.start || bar >= span.start + span.bars),
        sections: state.sections.filter((_, i) => i !== index),
      }
    }),
  renameSection: (index, name) =>
    set((state) =>
      state.sections[index]
        ? {
            ...remember(state, `section-name:${index}`),
            sections: state.sections.map((s, i) =>
              i === index ? { ...s, name: sectionName(name) } : s,
            ),
          }
        : state,
    ),
  setSectionBars: (index, bars) =>
    set((state) => {
      const span = sectionSpans(state.sections)[index]
      if (!span) return state
      const end = span.start + span.bars
      const want = Math.max(1, Math.trunc(bars))
      const count = Math.min(want, span.bars + (MAX_CHAIN - state.chain.length))
      if (count === span.bars) return state
      const last = state.chain[end - 1]!
      const middle =
        count > span.bars
          ? [
              ...state.chain.slice(span.start, end),
              ...Array.from({ length: count - span.bars }, () => last),
            ]
          : state.chain.slice(span.start, span.start + count)
      return {
        ...remember(state),
        chain: [...state.chain.slice(0, span.start), ...middle, ...state.chain.slice(end)],
        sections: state.sections.map((s, i) => (i === index ? { ...s, bars: count } : s)),
      }
    }),
  fillSection: (index, pattern) =>
    set((state) => {
      const span = sectionSpans(state.sections)[index]
      if (!span) return state
      const at = slot(pattern)
      return {
        ...remember(state),
        chain: state.chain.map((p, bar) =>
          bar >= span.start && bar < span.start + span.bars ? at : p,
        ),
      }
    }),
  duplicateSection: (index) =>
    set((state) => {
      const span = sectionSpans(state.sections)[index]
      if (!span) return state
      const end = span.start + span.bars
      const count = Math.min(span.bars, MAX_CHAIN - state.chain.length)
      if (count <= 0) return state
      const copy = state.chain.slice(span.start, span.start + count)
      return {
        ...remember(state),
        chain: [...state.chain.slice(0, end), ...copy, ...state.chain.slice(end)],
        sections: state.sections.flatMap((s, i) =>
          i === index ? [s, { name: s.name, bars: count }] : [s],
        ),
        followSong: true,
      }
    }),
  moveSection: (index, direction) =>
    set((state) => {
      const spans = sectionSpans(state.sections)
      const [a, b] = direction < 0 ? [index - 1, index] : [index, index + 1]
      const first = spans[a]
      const second = spans[b]
      if (!first || !second) return state
      const end = second.start + second.bars
      const chain = [
        ...state.chain.slice(0, first.start),
        ...state.chain.slice(second.start, end),
        ...state.chain.slice(first.start, second.start),
        ...state.chain.slice(end),
      ]
      const sections = [...state.sections]
      ;[sections[a], sections[b]] = [sections[b]!, sections[a]!]
      return { ...remember(state), chain, sections }
    }),
  applyStructure: (structure, pattern) =>
    set((state) => ({
      ...remember(state),
      ...layOut(structure, slot(pattern ?? state.activePattern)),
      followSong: true,
    })),

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
    const source = selectInstance(state, from)
    const target = selectInstance(state, to)
    if (!source || !target || from === to || source.kind !== target.kind) return false
    set({
      ...remember(state),
      instances: state.instances.map((i) =>
        i.id === to
          ? ({ ...i, params: structuredClone(source.params), ...withKey(source.key) } as Instance)
          : i,
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
      pan: source.pan,
      space: { ...source.space },
      ...withKey(source.key),
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
            params:
              i.kind === "video"
                ? // A VID-1's file and loop region are not "sound": they stay.
                  {
                    ...defaultParams(i.kind),
                    videoName: i.params.videoName,
                    bars: i.params.bars,
                    start: i.params.start,
                    end: i.params.end,
                  }
                : defaultParams(i.kind),
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
        if (hasOwnFilter(i.kind)) {
          return {
            ...i,
            // The guard narrows the kind, not the instance: the params are the kind's, by construction.
            params: clampParams(i.kind, {
              ...i.params,
              ...randomSynthFilter(i.kind, rng),
            } as never),
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
        if (hasOwnFilter(i.kind)) {
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
    const target = selectInstance(state, id)
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
  setInstancePan: (id, pan) =>
    set((state) => ({
      ...remember(state, `pan:${id}`),
      ...editInstance(state, id, (i) => ({ ...i, pan: clamp(pan, PAN_RANGE.min, PAN_RANGE.max) })),
    })),
  setInstanceSpace: (id, patch) =>
    set((state) => ({
      ...remember(state, `space:${id}:${Object.keys(patch).sort().join(",")}`),
      ...editInstance(state, id, (i) => ({ ...i, space: clampSpace({ ...i.space, ...patch }) })),
    })),
  setInstanceMute: (id, mute) =>
    set((state) => ({
      ...remember(state),
      ...editInstance(state, id, (i) => ({ ...i, mute })),
    })),
  setInstanceKey: (id, patch) =>
    set((state) => {
      const inst = selectInstance(state, id)
      if (!inst || !isMelodicKind(inst.kind)) return state
      const base = inst.key ?? KEY_DEFAULT[inst.kind]
      return {
        ...remember(state, `key:${id}:${Object.keys(patch).sort().join(",")}`),
        ...editInstance(state, id, (i) => ({ ...i, key: clampKey({ ...base, ...patch }, base) })),
      }
    }),
  setInstanceFilter: (id, patch) =>
    set((state) => {
      const inst = selectInstance(state, id)
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
    const inst = selectInstance(state, id)
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
        sections: song.sections,
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
    case "video":
    case "mic":
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
          space: { ...i.space },
          ...(i.filter ? { filter: { ...i.filter } } : {}),
          mod: structuredClone(i.mod),
          ...withKey(i.key),
        }) as Instance,
    ),
    patterns: state.patterns.map((p) => ({
      tracks: Object.fromEntries(Object.entries(p.tracks).map(([id, t]) => [id, copyTrack(t)])),
      ...(p.muted?.length ? { muted: [...p.muted] } : {}),
    })),
    activePattern: state.activePattern,
    chain: [...state.chain],
    sections: state.sections.map((s) => ({ ...s })),
    fx: { ...state.fx },
  }
}
