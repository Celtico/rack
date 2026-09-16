import { encodeMp3 } from "./mp3"
import { encodeWav, type PcmSource } from "./wav"

export type AudioFormat = "wav" | "mp3"

/** What the main thread sends the encoding worker: the rendered channels (transferred) and the format. */
export interface EncodeRequest {
  format: AudioFormat
  sampleRate: number
  channels: Float32Array[]
}

/** What comes back: the file, or why there is none. */
export type EncodeReply = { ok: true; blob: Blob } | { ok: false; message: string }

/** The channels as the encoders read an `AudioBuffer`. */
export const pcmSource = (sampleRate: number, channels: readonly Float32Array[]): PcmSource => ({
  numberOfChannels: channels.length,
  sampleRate,
  length: channels[0]?.length ?? 0,
  getChannelData: (c) => channels[c]!,
})

/** WAV or MP3 from the channels — the same call the worker and the main-thread fallback make. */
export async function encodePcm(format: AudioFormat, source: PcmSource): Promise<Blob> {
  return format === "wav"
    ? new Blob([encodeWav(source)], { type: "audio/wav" })
    : encodeMp3(source)
}
