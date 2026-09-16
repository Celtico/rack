import type { ReactNode } from "react"
import {
  LuAudioWaveform,
  LuBellRing,
  LuClapperboard,
  LuDrum,
  LuGuitar,
  LuLayers,
  LuMic,
  LuPiano,
  LuWaves,
  LuZap,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import type { KindParams } from "../state/instances"
import type { Kind } from "../state/pattern"
import type { LfoParams, MacroTarget, ModParams, RandomParams } from "../state/mod"
import type { FilterParams, Waveform } from "../state/params"
import { useRackStore } from "../state/store"
import type { Finish } from "../theme/recipes/rackUnit"

/** Panel finish per kind. */
export const KIND_FINISH: Readonly<Record<Kind, Finish>> = {
  drums: "red",
  perc: "rust",
  sampler: "teal",
  synth: "blue",
  bass: "silver",
  poly: "purple",
  ep: "cream",
  strings: "wood",
  video: "cyan",
  mic: "yellow",
}

/** Header pictogram per kind. */
export function kindIcon(kind: Kind): ReactNode {
  switch (kind) {
    case "drums":
      return <LuDrum />
    case "perc":
      return <LuBellRing />
    case "sampler":
      return <LuAudioWaveform />
    case "synth":
      return <LuWaves />
    case "bass":
      return <LuZap />
    case "poly":
      return <LuLayers />
    case "ep":
      return <LuPiano />
    case "strings":
      return <LuGuitar />
    case "video":
      return <LuClapperboard />
    case "mic":
      return <LuMic />
  }
}

/** Change part of an instance's params in the store and push it to the engine. */
export function changeParams(id: string, patch: Partial<KindParams[Kind]>): void {
  useRackStore.getState().setInstanceParams(id, patch)
  getEngine().setInstanceParams(id, patch)
}

/** Same, for the strip filter of a kind that has one. */
export function changeFilter(id: string, patch: Partial<FilterParams>): void {
  useRackStore.getState().setInstanceFilter(id, patch)
  getEngine().setInstanceFilter(id, patch)
}

/** After a reset or a random sound: the engine gets the instance's params, strip filter and modulation. */
export function pushSound(id: string): void {
  const inst = useRackStore.getState().instances.find((i) => i.id === id)
  if (!inst) return
  const engine = getEngine()
  engine.setInstanceParams(id, inst.params)
  if (inst.filter) engine.setInstanceFilter(id, inst.filter)
  engine.setInstanceMod(id, inst.mod)
}

/** The engine takes the whole modulation block; after any change it gets the fresh one. */
const pushMod = (id: string) => {
  const mod = useRackStore.getState().instances.find((i) => i.id === id)?.mod
  if (mod) getEngine().setInstanceMod(id, mod)
}

export function changeMod(id: string, patch: Partial<Pick<ModParams, "tune" | "drive">>): void {
  useRackStore.getState().setInstanceMod(id, patch)
  pushMod(id)
}

export function changeLfo(id: string, index: 0 | 1, patch: Partial<LfoParams>): void {
  useRackStore.getState().setInstanceLfo(id, index, patch)
  pushMod(id)
}

export function changeRandom(id: string, patch: Partial<RandomParams>): void {
  useRackStore.getState().setInstanceRandom(id, patch)
  pushMod(id)
}

/** Turn a macro: the store moves its targets and says what changed; the engine follows. */
export function changeMacro(id: string, index: number, value: number): void {
  const patches = useRackStore.getState().setMacro(id, index, value)
  if (!patches) return
  const engine = getEngine()
  if (Object.keys(patches.params).length) engine.setInstanceParams(id, patches.params as never)
  if (Object.keys(patches.filter).length) engine.setInstanceFilter(id, patches.filter)
  pushMod(id)
}

export function changeMacroTargets(id: string, index: number, targets: MacroTarget[]): void {
  useRackStore.getState().setMacroTargets(id, index, targets)
}

export const formatPercent = (v: number) => `${Math.round(v * 100)}%`
export const formatHz = (v: number) => `${Math.round(v)} Hz`
export const formatQ = (v: number) => `Q ${v.toFixed(1)}`
export const formatMs = (v: number) => (v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`)
export const formatSeconds = (v: number) => `${v.toFixed(2)} s`

export const WAVE_LABELS: Readonly<Record<Waveform, string>> = {
  sawtooth: "Saw",
  square: "Sqr",
  triangle: "Tri",
  sine: "Sin",
}

/** What the kit rows and level knobs call each voice. */
export const VOICE_LABELS: Readonly<Record<string, string>> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  hat: "Hat",
  tomLo: "Tom lo",
  tomHi: "Tom hi",
  rim: "Rim",
  cowbell: "Cowbell",
  shaker: "Shaker",
  crash: "Crash",
  gate: "Gate",
}
