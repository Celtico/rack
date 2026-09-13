import type { Waveform } from "../../state/params"

type FatType = "fatsawtooth" | "fatsquare" | "fattriangle"
const FAT: Readonly<Record<Exclude<Waveform, "sine">, FatType>> = {
  sawtooth: "fatsawtooth",
  square: "fatsquare",
  triangle: "fattriangle",
}

/**
 * A single oscillator sounds like a test tone. "Fat" oscillators stack a few
 * copies a little detuned from each other — the unison of a real synth — for
 * every waveform but the sine, which has nothing to thicken.
 */
export function fatOscillator(
  type: Waveform,
  count: number,
  spread: number,
): { type: "sine" } | { type: FatType; count: number; spread: number } {
  return type === "sine" ? { type: "sine" } : { type: FAT[type], count, spread }
}
