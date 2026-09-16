import { encodePcm, pcmSource, type EncodeReply, type EncodeRequest } from "./encodePcm"

/**
 * The encoding worker: a WAV takes a moment, an MP3 of a long song takes
 * seconds of pure JavaScript, and neither belongs on the thread that draws the
 * rack. Started by `encodeAudio` for one file and dropped after. Nothing but
 * this file runs here, and nothing else imports it — its top level sets the
 * worker's `onmessage`, which on the page would be the window's.
 */
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<EncodeRequest>) => void) | null
  postMessage(reply: EncodeReply): void
}
scope.onmessage = async (e) => {
  const { format, sampleRate, channels } = e.data
  try {
    scope.postMessage({ ok: true, blob: await encodePcm(format, pcmSource(sampleRate, channels)) })
  } catch (err) {
    scope.postMessage({ ok: false, message: err instanceof Error ? err.message : String(err) })
  }
}
