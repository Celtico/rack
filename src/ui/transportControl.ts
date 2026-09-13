import { getEngine } from "../audio/engine"
import { useRackStore } from "../state/store"

/** Start the clock. Builds the graph on first use; waits for a user gesture if the browser demands one. */
export async function startTransport(): Promise<void> {
  await getEngine().start()
  useRackStore.getState().setPlaying(true)
}

export function stopTransport(): void {
  const { setPlaying, setPlayhead } = useRackStore.getState()
  getEngine().stop()
  setPlaying(false)
  setPlayhead(-1, -1, -1)
}

/**
 * The rack plays as soon as it can. Browsers keep audio suspended until the
 * page is touched, so the first pointer or key also (re)starts the clock.
 * After that, every tap and every return to the tab checks that the audio
 * context still runs: iOS silences it ("interrupted") when the screen locks
 * or another app takes over, while the clock keeps going, so it has to be
 * woken again — and only a gesture is allowed to do that.
 */
export function autoplay(): () => void {
  void startTransport()
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
  window.addEventListener("pointerdown", once)
  window.addEventListener("keydown", once)
  window.addEventListener("pointerdown", wake)
  document.addEventListener("visibilitychange", wake)
  return () => {
    stopOnce()
    window.removeEventListener("pointerdown", wake)
    document.removeEventListener("visibilitychange", wake)
  }
}
