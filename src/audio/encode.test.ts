import { describe, expect, it } from "vitest"

import { encodeAudio } from "./encode"
import { pcmSource } from "./encodePcm"

describe("encodeAudio", () => {
  it("encodes a buffer's channels as a WAV file (on this thread where there are no workers)", async () => {
    const left = Float32Array.from([0, 0.5, -0.5, 1])
    const right = Float32Array.from([1, -1, 0.25, 0])
    const source = pcmSource(44100, [left, right])
    expect(source.numberOfChannels).toBe(2)
    expect(source.length).toBe(4)

    const blob = await encodeAudio(source, "wav")
    expect(blob.type).toBe("audio/wav")
    // 44 header bytes + 4 frames × 2 channels × 2 bytes.
    expect(blob.size).toBe(44 + 16)
    // The render's own buffer is untouched: the worker path transfers a copy.
    expect(left.length).toBe(4)
  })
})
