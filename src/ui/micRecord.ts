import { getMicStream } from "../audio/mic"

/** The longest clip the sampler's Rec button takes, seconds. */
const CLIP_MAX_SECONDS = 10

/** The audio container the browser writes, and the file extension that goes with it. */
function clipFormat(): { mime: string; ext: string } {
  const candidates = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ]
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? { mime: "", ext: "webm" }
}

export interface ClipRecording {
  /** Stop early; the clip resolves with what was taken. */
  stop: () => void
  /** The clip's bytes and a file name, once stopped or `CLIP_MAX_SECONDS` have passed. */
  done: Promise<{ name: string; type: string; data: ArrayBuffer }>
}

/**
 * Record a clip from the microphone with a `MediaRecorder` — for a sampler
 * pad, where a one-shot need not sit on the bar. Asks for the microphone if
 * it has not been granted yet.
 */
export async function recordClip(name: string): Promise<ClipRecording> {
  if (typeof MediaRecorder === "undefined") throw new Error("this browser cannot record audio")
  const stream = await getMicStream()
  const { mime, ext } = clipFormat()
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const parts: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) parts.push(e.data)
  }
  const done = new Promise<{ name: string; type: string; data: ArrayBuffer }>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(parts, { type: recorder.mimeType || mime })
      blob
        .arrayBuffer()
        .then((data) => resolve({ name: `${name}.${ext}`, type: blob.type, data }))
        .catch(reject)
    }
    recorder.onerror = () => reject(new Error("the recording failed"))
  })
  recorder.start()
  const timer = setTimeout(() => stop(), CLIP_MAX_SECONDS * 1000)
  const stop = () => {
    clearTimeout(timer)
    if (recorder.state !== "inactive") recorder.stop()
  }
  return { stop, done }
}
