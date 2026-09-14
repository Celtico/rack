import { encodeMp3 } from "../audio/mp3"
import { renderSong } from "../audio/render"
import { encodeWav } from "../audio/wav"
import { toaster } from "../components/ui/toaster"
import type { Song } from "../state/song"
import { songFileName } from "../state/songLibrary"
import { downloadBlob } from "./download"

export type AudioFormat = "wav" | "mp3"

/**
 * Render a song offline and download it as audio. One toast follows the work
 * from "rendering" to done or to the error; the rack keeps playing meanwhile.
 */
export function exportSongAudio(song: Song, name: string, format: AudioFormat): Promise<void> {
  const label = format.toUpperCase()
  const work = (async () => {
    const buffer = await renderSong(song)
    const blob =
      format === "wav"
        ? new Blob([encodeWav(buffer)], { type: "audio/wav" })
        : await encodeMp3(buffer)
    downloadBlob(songFileName(name, format), blob)
  })()
  toaster.promise(work, {
    loading: { title: `Rendering ${label}…`, description: name },
    success: { title: `${label} exported`, description: name },
    error: (err: unknown) => ({
      title: `Could not export ${label}`,
      description: err instanceof Error ? err.message : String(err),
    }),
  })
  // The toast already reports a failure; nobody upstream needs the rejection too.
  return work.catch(() => undefined)
}
