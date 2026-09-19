import { registerSW } from "virtual:pwa-register"

import { useRackStore } from "../state/store"

/** How often an open rack asks the server whether there is a newer build. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Keep the installed app current. The service worker (Workbox, `autoUpdate`)
 * takes over as soon as a new build is fetched and drops the old build's
 * caches; this makes sure the check happens while the rack stays open — every
 * hour and whenever the tab comes back into view, since a browser only checks
 * by itself on a navigation — and reloads the page into the new build once it
 * is in, waiting for the clock to stop rather than cutting a performance short.
 */
export function installUpdates(): void {
  const reloadWhenIdle = () => {
    if (!useRackStore.getState().playing) {
      window.location.reload()
      return
    }
    const unsubscribe = useRackStore.subscribe((s) => {
      if (s.playing) return
      unsubscribe()
      window.location.reload()
    })
  }
  registerSW({
    immediate: true,
    onNeedReload: reloadWhenIdle,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => undefined)
      setInterval(check, UPDATE_CHECK_MS)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check()
      })
    },
  })
}
