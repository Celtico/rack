import { useEffect } from "react"

import { loadDefaultSong } from "./ui/defaultSong"
import { Rack } from "./ui/Rack"
import { autoplay } from "./ui/transportControl"
import { installWakeLock } from "./ui/wakeLock"

export default function App() {
  useEffect(() => {
    let stop: (() => void) | undefined
    void loadDefaultSong().then(() => {
      stop = autoplay()
    })
    // A phone must not dim and lock while the rack is playing.
    const releaseWakeLock = installWakeLock()
    return () => {
      stop?.()
      releaseWakeLock()
    }
  }, [])
  return <Rack />
}
