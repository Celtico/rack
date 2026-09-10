import { getEngine, type Levels } from "../audio/engine"

type Listener = (levels: Levels) => void

const listeners = new Set<Listener>()
let frame = 0
let odd = true

const tick = () => {
  frame = requestAnimationFrame(tick)
  // 30 Hz is plenty for LED ballistics and halves the analyser reads.
  odd = !odd
  if (odd) return
  const levels = getEngine().getLevels()
  for (const cb of listeners) cb(levels)
}

/**
 * One animation-frame loop for every meter on screen: the engine's analysers
 * are read once per frame and the numbers fanned out, instead of each meter
 * polling the whole engine on its own. Stops when the last meter leaves.
 */
export function subscribeLevels(cb: Listener): () => void {
  listeners.add(cb)
  if (listeners.size === 1) {
    odd = true
    frame = requestAnimationFrame(tick)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) cancelAnimationFrame(frame)
  }
}
