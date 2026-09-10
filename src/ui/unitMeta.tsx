import type { ReactNode } from "react"
import {
  LuAudioWaveform,
  LuBellRing,
  LuDrum,
  LuGuitar,
  LuLayers,
  LuPiano,
  LuWaves,
  LuZap,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import type { KindParams } from "../state/instances"
import type { Kind } from "../state/pattern"
import type { Waveform } from "../state/params"
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
  }
}

/** Change part of an instance's params in the store and push it to the engine. */
export function changeParams(id: string, patch: Partial<KindParams[Kind]>): void {
  useRackStore.getState().setInstanceParams(id, patch)
  getEngine().setInstanceParams(id, patch)
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
