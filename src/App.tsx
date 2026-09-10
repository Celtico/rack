import { useEffect } from "react"

import { loadDefaultSong } from "./ui/defaultSong"
import { Rack } from "./ui/Rack"

export default function App() {
  useEffect(() => {
    void loadDefaultSong()
  }, [])
  return <Rack />
}
