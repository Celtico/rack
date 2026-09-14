/** The part of an `AudioBuffer` an encoder reads — kept small so tests need no Web Audio. */
export interface PcmSource {
  numberOfChannels: number
  sampleRate: number
  length: number
  getChannelData(channel: number): Float32Array
}

/** One float sample in −1…1 to signed 16-bit, clipped. */
export const to16 = (s: number): number => {
  const c = s < -1 ? -1 : s > 1 ? 1 : s
  return c < 0 ? c * 0x8000 : c * 0x7fff
}

/** Float samples in −1…1 to signed 16-bit, clipped — a slice at a time keeps the copies small. */
export function floatTo16(samples: Float32Array, from = 0, to = samples.length): Int16Array {
  const out = new Int16Array(to - from)
  for (let i = from; i < to; i++) out[i - from] = to16(samples[i]!)
  return out
}

const HEADER_BYTES = 44
const BYTES_PER_SAMPLE = 2

/**
 * A canonical RIFF/WAVE file: 16-bit PCM, channels interleaved. Nothing but
 * the 44-byte header and the samples, which every DAW and player reads.
 */
export function encodeWav(buffer: PcmSource): ArrayBuffer {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const dataBytes = frames * channels * BYTES_PER_SAMPLE
  const out = new ArrayBuffer(HEADER_BYTES + dataBytes)
  const view = new DataView(out)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, "RIFF")
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * BYTES_PER_SAMPLE, true) // byte rate
  view.setUint16(32, channels * BYTES_PER_SAMPLE, true) // block align
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true) // bits per sample
  ascii(36, "data")
  view.setUint32(40, dataBytes, true)

  // Straight into the file's sample area, interleaved, one pass — no per-channel copies.
  const pcm = new Int16Array(out, HEADER_BYTES)
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c))
  for (let i = 0, o = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) pcm[o++] = to16(data[c]![i]!)
  }
  return out
}
