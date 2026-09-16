/**
 * The microphone: one `MediaStream` shared by every MIC-1 and by the sampler's
 * Rec button. Asked for once, behind a user gesture (the browser prompts), and
 * kept until the page goes. No processing, no echo cancellation: a singer wants
 * the raw input, and the browser's voice tricks chew up music.
 */
let stream: MediaStream | null = null
let pending: Promise<MediaStream> | null = null

export async function getMicStream(): Promise<MediaStream> {
  if (stream?.active) return stream
  if (pending) return pending
  pending = navigator.mediaDevices
    .getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    .then((s) => {
      stream = s
      return s
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** The stream if the microphone has been granted, else null. */
export const micStream = (): MediaStream | null => (stream?.active ? stream : null)
