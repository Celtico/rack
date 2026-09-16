import { useEffect, useState } from "react"

import { listTakes, type Take } from "../audio/sampleStore"

/** Reload the lists on every panel when a take is added or removed anywhere. */
const listeners = new Set<() => void>()
export const takesChanged = (): void => {
  for (const cb of listeners) cb()
}

/** The takes in the browser, newest first, refreshed whenever one is added or removed. */
export function useTakes(): Take[] {
  const [takes, setTakes] = useState<Take[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void listTakes().then((t) => {
        if (alive) setTakes(t)
      })
    }
    load()
    listeners.add(load)
    return () => {
      alive = false
      listeners.delete(load)
    }
  }, [])
  return takes
}

const when = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

/** "2 bars · 120 BPM · 18:52", or just the time for a clip. Pure but for the locale. */
export const takeMeta = (t: Take): string =>
  [
    t.bars !== undefined ? `${t.bars} bar${t.bars === 1 ? "" : "s"}` : null,
    t.bpm !== undefined ? `${Math.round(t.bpm)} BPM` : null,
    when(t.takenAt),
  ]
    .filter(Boolean)
    .join(" · ")
