/* global AudioWorkletProcessor, registerProcessor, currentFrame */
/**
 * The recorder behind MIC-1's loops: copies its input (channel 0) between two
 * frames of the context's clock into one buffer and posts it when the end
 * frame passes. The frames come from the transport's scheduled times, so a
 * loop is cut exactly on the bar — a `MediaRecorder` starts when it likes.
 *
 * One job at a time: `{ start, length }` in frames. `{ stopAt }` moves the end
 * earlier (the take is posted as long as it got); `{ cancel: true }` drops it
 * and posts null. Silence is captured where nothing is connected yet.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.job = null
    this.port.onmessage = (e) => {
      const m = e.data
      if (m.cancel) {
        this.job = null
        this.port.postMessage(null)
      } else if (m.stopAt !== undefined) {
        if (this.job) this.job.end = Math.max(this.job.start, Math.min(this.job.end, m.stopAt))
      } else {
        this.job = { start: m.start, end: m.start + m.length, buffer: new Float32Array(m.length) }
      }
    }
  }

  process(inputs) {
    const job = this.job
    if (!job) return true
    const input = inputs[0] && inputs[0][0]
    const quantum = input ? input.length : 128
    const blockStart = currentFrame
    const blockEnd = blockStart + quantum
    if (blockEnd <= job.start) return true
    if (blockStart >= job.end) {
      this.finish()
      return true
    }
    const from = Math.max(job.start, blockStart)
    const to = Math.min(job.end, blockEnd)
    if (input) job.buffer.set(input.subarray(from - blockStart, to - blockStart), from - job.start)
    if (to >= job.end) this.finish()
    return true
  }

  finish() {
    const job = this.job
    this.job = null
    // As long as the take got — the whole job, or up to an early stop.
    const taken = new Float32Array(job.buffer.subarray(0, job.end - job.start))
    this.port.postMessage(taken, [taken.buffer])
  }
}

registerProcessor("rack-capture", CaptureProcessor)
