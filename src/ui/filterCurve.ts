import type { FilterType } from "../state/params"

/** What the dropdown prints for each type. */
export const FILTER_LABELS: Readonly<Record<FilterType, string>> = {
  lowpass: "Lowpass",
  highpass: "Highpass",
  bandpass: "Bandpass",
  notch: "Notch",
}

/** The sample rate the curve is drawn for; the shape barely depends on it. */
const SAMPLE_RATE = 44100
/** The synths' filters are 24 dB: Tone cascades two identical biquads. */
const STAGES = 2

/** Frequency axis of the curve: log from 20 Hz to 20 kHz. */
export const CURVE_MIN_HZ = 20
export const CURVE_MAX_HZ = 20000

/**
 * Gain in dB of one of the rack's filters at `hz`, from the Web Audio biquad
 * formulas (the RBJ cookbook as the spec has it). For lowpass and highpass
 * the spec reads Q in dB, so a "resonance" of 12 is a 12 dB peak; bandpass and
 * notch take Q as a plain quality factor. Pure.
 */
export function filterGainDb(type: FilterType, cutoff: number, q: number, hz: number): number {
  const w0 = (2 * Math.PI * cutoff) / SAMPLE_RATE
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const linearQ = type === "lowpass" || type === "highpass" ? 10 ** (q / 20) : q
  const alpha = sin / (2 * Math.max(linearQ, 1e-4))
  let b0: number, b1: number, b2: number
  switch (type) {
    case "lowpass":
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = (1 - cos) / 2
      break
    case "highpass":
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = (1 + cos) / 2
      break
    case "bandpass":
      b0 = alpha
      b1 = 0
      b2 = -alpha
      break
    case "notch":
      b0 = 1
      b1 = -2 * cos
      b2 = 1
      break
    default:
      // A type from nowhere (an instance older than the field): drawn as the lowpass it plays as.
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = (1 - cos) / 2
  }
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha

  // |H(e^jw)| = |b0 + b1 e^-jw + b2 e^-2jw| / |a0 + a1 e^-jw + a2 e^-2jw|
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  const c1 = Math.cos(w)
  const s1 = Math.sin(w)
  const c2 = Math.cos(2 * w)
  const s2 = Math.sin(2 * w)
  const numRe = b0 + b1 * c1 + b2 * c2
  const numIm = -(b1 * s1 + b2 * s2)
  const denRe = a0 + a1 * c1 + a2 * c2
  const denIm = -(a1 * s1 + a2 * s2)
  const mag = Math.sqrt((numRe ** 2 + numIm ** 2) / (denRe ** 2 + denIm ** 2))
  return STAGES * 20 * Math.log10(Math.max(mag, 1e-6))
}

/** `points` gains in dB, evenly spaced in log frequency across the curve's axis. */
export function filterCurve(type: FilterType, cutoff: number, q: number, points: number): number[] {
  const out: number[] = []
  for (let i = 0; i < points; i++) {
    const hz = CURVE_MIN_HZ * (CURVE_MAX_HZ / CURVE_MIN_HZ) ** (i / (points - 1))
    out.push(filterGainDb(type, cutoff, q, hz))
  }
  return out
}

/** Where `hz` sits on the curve's log axis, 0–1. */
export const curveX = (hz: number): number =>
  Math.log(hz / CURVE_MIN_HZ) / Math.log(CURVE_MAX_HZ / CURVE_MIN_HZ)
