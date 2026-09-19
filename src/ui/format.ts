/** Readouts for knobs, faders and displays — one spelling of each unit across the rack. */

export const formatPercent = (v: number) => `${Math.round(v * 100)}%`
export const formatHz = (v: number) => `${Math.round(v)} Hz`
/** LFO rates: two decimals under 1 Hz, one above. */
export const formatHzShort = (v: number) => (v < 1 ? `${v.toFixed(2)} Hz` : `${v.toFixed(1)} Hz`)
export const formatQ = (v: number) => `Q ${v.toFixed(1)}`
/** Envelope times: milliseconds under a second. */
export const formatMs = (v: number) => (v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`)
export const formatSeconds = (v: number, decimals = 2) => `${v.toFixed(decimals)} s`
export const formatSemitones = (v: number) => `${v > 0 ? "+" : ""}${v} st`
export const formatBpm = (bpm: number) => `${bpm} BPM`
export const formatAngle = (v: number) => `${Math.round(v)}°`
/** "L 40", "C", "R 100". */
export const formatPan = (v: number) =>
  Math.abs(v) < 0.005 ? "C" : `${v < 0 ? "L" : "R"} ${Math.round(Math.abs(v) * 100)}`
export const formatRatio = (v: number) => `${v.toFixed(2)}×`
/** "1:05.3" — a position in a clip. */
export const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`
