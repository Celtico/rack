import { floatTo16, type PcmSource } from "./wav"

/** Bitrate of an exported MP3 — plenty for a rack mix. */
export const MP3_KBPS = 192
/** Samples per encoder call: a multiple of the MP3 frame (1152), a few tenths of a second. */
const BLOCK = 1152 * 16
/** Encoder calls between yields to the event loop, so a long song does not freeze the page. */
const YIELD_EVERY = 2

/**
 * Encode a rendered buffer as MP3 with the LAME port. The encoder is loaded on
 * first use — it is a few hundred kilobytes nobody needs until they export.
 */
export async function encodeMp3(buffer: PcmSource, kbps = MP3_KBPS): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs")
  const channels = Math.min(2, buffer.numberOfChannels)
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps)
  const left = buffer.getChannelData(0)
  const right = channels === 2 ? buffer.getChannelData(1) : undefined
  const parts: Uint8Array<ArrayBuffer>[] = []
  // Converted a block at a time: a whole song as Int16 would be two more copies of it in memory.
  for (let i = 0, block = 0; i < left.length; i += BLOCK, block++) {
    const end = Math.min(i + BLOCK, left.length)
    const out = encoder.encodeBuffer(
      floatTo16(left, i, end),
      right ? floatTo16(right, i, end) : undefined,
    )
    if (out.length) parts.push(new Uint8Array(out))
    if (block % YIELD_EVERY === YIELD_EVERY - 1) await new Promise((r) => setTimeout(r, 0))
  }
  const tail = encoder.flush()
  if (tail.length) parts.push(new Uint8Array(tail))
  return new Blob(parts, { type: "audio/mpeg" })
}
