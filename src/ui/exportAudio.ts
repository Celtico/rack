import { encodeAudio, type AudioFormat } from "../audio/encode"
import { renderSong } from "../audio/render"
import { toaster } from "../components/ui/toaster"
import { errorText } from "./errors"
import type { Song } from "../state/song"
import { songFileName } from "../state/songLibrary"
import { downloadBlob } from "./download"

export type { AudioFormat } from "../audio/encode"

/**
 * Render a song offline and download it as audio. One toast follows the work
 * from "rendering" to done or to the error; the rack keeps playing meanwhile —
 * the render runs in the audio subsystem and the encoding in a worker.
 */
export function exportSongAudio(song: Song, name: string, format: AudioFormat): Promise<void> {
  const label = format.toUpperCase()
  const work = (async () => {
    const buffer = await renderSong(song)
    downloadBlob(songFileName(name, format), await encodeAudio(buffer, format))
  })()
  toaster.promise(work, {
    loading: { title: `Rendering ${label}…`, description: name },
    success: { title: `${label} exported`, description: name },
    error: (err: unknown) => ({
      title: `Could not export ${label}`,
      description: errorText(err),
    }),
  })
  // The toast already reports a failure; nobody upstream needs the rejection too.
  return work.catch(() => undefined)
}
