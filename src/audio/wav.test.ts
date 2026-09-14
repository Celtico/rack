import { describe, expect, it } from "vitest"

import { encodeWav, floatTo16, type PcmSource } from "./wav"

const source = (channels: Float32Array[], sampleRate = 8000): PcmSource => ({
  numberOfChannels: channels.length,
  sampleRate,
  length: channels[0]!.length,
  getChannelData: (c) => channels[c]!,
})

const text = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join("")

describe("floatTo16", () => {
  it("scales and clips", () => {
    expect(Array.from(floatTo16(new Float32Array([0, 1, -1, 0.5, 2, -2])))).toEqual([
      0, 32767, -32768, 16383, 32767, -32768,
    ])
  })
})

describe("encodeWav", () => {
  it("writes a canonical 16-bit PCM header", () => {
    const bytes = encodeWav(source([new Float32Array(10), new Float32Array(10)], 44100))
    const view = new DataView(bytes)
    expect(bytes.byteLength).toBe(44 + 10 * 2 * 2)
    expect(text(view, 0, 4)).toBe("RIFF")
    expect(view.getUint32(4, true)).toBe(36 + 40)
    expect(text(view, 8, 4)).toBe("WAVE")
    expect(text(view, 12, 4)).toBe("fmt ")
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(44100 * 4)
    expect(view.getUint16(32, true)).toBe(4)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(view, 36, 4)).toBe("data")
    expect(view.getUint32(40, true)).toBe(40)
  })

  it("interleaves the channels", () => {
    const bytes = encodeWav(source([new Float32Array([0.5, -0.5]), new Float32Array([1, -1])]))
    const view = new DataView(bytes)
    const samples = Array.from({ length: 4 }, (_, i) => view.getInt16(44 + i * 2, true))
    expect(samples).toEqual([16383, 32767, -16384, -32768])
  })
})
