import { useEffect } from "react"

import { loadDefaultSong } from "./ui/defaultSong"
import { Rack } from "./ui/Rack"
import { autoplay } from "./ui/transportControl"

export default function App() {
  useEffect(() => {
    let stop: (() => void) | undefined
    void loadDefaultSong().then(() => {
      stop = autoplay()
    })
    return () => stop?.()
  }, [])
  return <Rack />
}
