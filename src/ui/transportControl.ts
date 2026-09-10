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
 */
export function autoplay(): () => void {
  void startTransport()
  const once = () => {
    stop()
    if (!useRackStore.getState().playing) void startTransport()
  }
  const stop = () => {
    window.removeEventListener("pointerdown", once)
    window.removeEventListener("keydown", once)
  }
  window.addEventListener("pointerdown", once)
  window.addEventListener("keydown", once)
  return stop
}
