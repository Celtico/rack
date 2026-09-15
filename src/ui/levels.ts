import { getEngine, type LevelSource } from "../audio/engine"

type Listener = (level: number) => void

/** Who wants which meter: the loop reads only those analysers. */
const listeners = new Map<LevelSource, Set<Listener>>()
let count = 0
let frame = 0
let odd = true

const tick = () => {
  frame = requestAnimationFrame(tick)
  // 30 Hz is plenty for LED ballistics and halves the analyser reads.
  odd = !odd
  if (odd) return
  const engine = getEngine()
  for (const [source, set] of listeners) {
    const level = engine.getLevel(source)
    for (const cb of set) cb(level)
  }
}

/**
 * One animation-frame loop for every meter on screen: each analyser someone
 * watches is read once per frame and the number fanned out, instead of every
 * meter polling the engine on its own — and analysers nobody shows are never
 * read. Stops when the last meter leaves.
 */
export function subscribeLevels(source: LevelSource, cb: Listener): () => void {
  let set = listeners.get(source)
  if (!set) {
    set = new Set()
    listeners.set(source, set)
  }
  set.add(cb)
  if (count++ === 0) {
    odd = true
    frame = requestAnimationFrame(tick)
  }
  return () => {
    set.delete(cb)
    if (set.size === 0) listeners.delete(source)
    if (--count === 0) cancelAnimationFrame(frame)
  }
}
