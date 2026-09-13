import { Oscillator, type ToneOscillatorNode } from "tone"

/**
 * Tone 15.1 leaks every oscillator a synth ever starts. `Oscillator` makes a
 * fresh native OscillatorNode per note and wires its `frequency` and `detune`
 * signals into the new node's params — and never unwires them when the note
 * is over: `dispose()` only disconnects the node's own output. The
 * standardized-audio-context layer under Tone keeps a record of every
 * connection on the *source* side (the signal, which lives as long as the
 * synth), so each finished node stays reachable from a live object and is
 * never collected. A hi-hat on every sixteenth leaks a hundred oscillators a
 * second; a phone runs out of memory in minutes.
 *
 * The fix is to detach the two control signals from a node as soon as its
 * note ends: Tone reports that through the node's `onended`, at the moment the
 * node's gain has been set to zero, so nothing audible changes.
 */
export function installTonePatches(): void {
  const proto = Oscillator.prototype as unknown as OscillatorLike
  if (proto.__rackPatched) return
  proto.__rackPatched = true

  const start = proto._start
  proto._start = function (this: OscillatorLike, time: number) {
    start.call(this, time)
    const node = this._oscillator
    if (!node) return
    const onended = node.onended
    node.onended = (source) => {
      try {
        this.frequency.disconnect(node.frequency.input)
        this.detune.disconnect(node.detune.input)
      } catch {
        // Already gone (the synth was disposed mid-note): nothing left to detach.
      }
      onended(source)
    }
  }
}

interface OscillatorLike {
  __rackPatched?: boolean
  _start(time: number): void
  _oscillator: ToneOscillatorNode | null
  frequency: { disconnect(destination: unknown): unknown }
  detune: { disconnect(destination: unknown): unknown }
}
