import { useRackStore } from "../state/store"

/**
 * Keep the screen on while the rack plays. Phones dim and lock a page that is
 * not being touched, which also suspends its audio; the Screen Wake Lock API
 * asks the browser not to. The lock is released when the tab is hidden, so it
 * is taken again whenever the tab comes back while still playing. Browsers
 * without the API, or that refuse, are simply left alone.
 */
export function installWakeLock(): () => void {
  let lock: WakeLockSentinel | null = null

  const acquire = async () => {
    if (lock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return
    try {
      const sentinel = await navigator.wakeLock.request("screen")
      sentinel.addEventListener("release", () => {
        if (lock === sentinel) lock = null
      })
      lock = sentinel
    } catch {
      // Not allowed here (low battery, permissions) — nothing to do.
    }
  }

  const release = () => {
    void lock?.release()
    lock = null
  }

  const sync = () => {
    if (useRackStore.getState().playing) void acquire()
    else release()
  }

  const unsubscribe = useRackStore.subscribe((s, prev) => {
    if (s.playing !== prev.playing) sync()
  })
  document.addEventListener("visibilitychange", sync)
  sync()

  return () => {
    unsubscribe()
    document.removeEventListener("visibilitychange", sync)
    release()
  }
}
