import { getEngine } from "../audio/engine"
import { useRackStore } from "../state/store"
import { playVideoLoops } from "./videoLoops"

/** Start the clock. Builds the graph on first use; waits for a user gesture if the browser demands one. */
export async function startTransport(): Promise<void> {
  // Still inside the click: the video loops may only start on a gesture.
  playVideoLoops()
  await getEngine().start()
  useRackStore.getState().setPlaying(true)
}

/**
 * Run the song from the start of `bar`: the clock starts there if stopped, or jumps there if it
 * runs. The song is resumed too — a slot picked from the bank would loop instead.
 */
export async function playFromBar(bar: number): Promise<void> {
  const { playing, setFollowSong, setPlaying } = useRackStore.getState()
  setFollowSong(true)
  if (playing) {
    getEngine().playFrom(bar)
    return
  }
  playVideoLoops()
  await getEngine().start(bar)
  setPlaying(true)
}

export function stopTransport(): void {
  const { setPlaying, setPlayhead } = useRackStore.getState()
  getEngine().stop()
  setPlaying(false)
  setPlayhead(-1, -1, -1)
}

/**
 * With `start`, the rack plays as soon as it can: browsers keep audio
 * suspended until the page is touched, so the first pointer or key also
 * (re)starts the clock. Always, every tap and every return to the tab checks
 * that the audio context still runs: iOS silences it ("interrupted") when the
 * screen locks or another app takes over, while the clock keeps going, so it
 * has to be woken again — and only a gesture is allowed to do that.
 */
export function autoplay(start: boolean): () => void {
  const once = () => {
    stopOnce()
    if (!useRackStore.getState().playing) void startTransport()
  }
  const stopOnce = () => {
    window.removeEventListener("pointerdown", once)
    window.removeEventListener("keydown", once)
  }
  const wake = () => {
    const engine = getEngine()
    if (useRackStore.getState().playing && !engine.audioRunning()) void engine.resumeAudio()
  }
  if (start) {
    void startTransport()
    window.addEventListener("pointerdown", once)
    window.addEventListener("keydown", once)
  }
  window.addEventListener("pointerdown", wake)
  document.addEventListener("visibilitychange", wake)
  return () => {
    stopOnce()
    window.removeEventListener("pointerdown", wake)
    document.removeEventListener("visibilitychange", wake)
  }
}
