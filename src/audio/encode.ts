import {
  encodePcm,
  pcmSource,
  type AudioFormat,
  type EncodeReply,
  type EncodeRequest,
} from "./encodePcm"
import type { PcmSource } from "./wav"

export type { AudioFormat } from "./encodePcm"

/**
 * A rendered buffer as a WAV or MP3 file, encoded in a Web Worker so the rack
 * keeps drawing (and playing smoothly) meanwhile. The channels are copied and
 * handed over by transfer — the render's own buffer stays whole. Where there
 * are no workers (tests), the encoders run right here.
 */
export function encodeAudio(buffer: PcmSource, format: AudioFormat): Promise<Blob> {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c).slice(),
  )
  if (typeof Worker === "undefined")
    return encodePcm(format, pcmSource(buffer.sampleRate, channels))
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./encodeWorker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<EncodeReply>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.blob)
      else reject(new Error(e.data.message))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || "the encoder failed"))
    }
    const request: EncodeRequest = { format, sampleRate: buffer.sampleRate, channels }
    worker.postMessage(
      request,
      channels.map((c) => c.buffer),
    )
  })
}
