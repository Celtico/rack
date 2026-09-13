import { useEffect } from "react"

import { loadDefaultSong } from "./ui/defaultSong"
import { Rack } from "./ui/Rack"
import { installBackgroundAudio } from "./ui/backgroundAudio"
import { autoplay } from "./ui/transportControl"
import { installWakeLock } from "./ui/wakeLock"

export default function App() {
  useEffect(() => {
    let stop: (() => void) | undefined
    // A saved song starts playing; an empty rack waits, silent, for the first note.
    void loadDefaultSong().then((loadedSong) => {
      stop = autoplay(loadedSong)
    })
    // A phone must not dim and lock while the rack is playing — and if it does lock, or another
    // app comes up, the silent media loop keeps the audio session (and the music) going.
    const releaseWakeLock = installWakeLock()
    const releaseBackgroundAudio = installBackgroundAudio()
    return () => {
      stop?.()
      releaseWakeLock()
      releaseBackgroundAudio()
    }
  }, [])
  return <Rack />
}
