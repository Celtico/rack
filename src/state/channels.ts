/** Mixer channels — one per sound module. The engine builds one strip for each. */
export const CHANNEL_IDS = [
  "drums",
  "perc",
  "sampler",
  "synth",
  "bass",
  "poly",
  "ep",
  "strings",
] as const
export type ChannelId = (typeof CHANNEL_IDS)[number]

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  drums: "DR-4",
  perc: "PERC-6",
  sampler: "SMP-8",
  synth: "MONO-1",
  bass: "BASS-2",
  poly: "POLY-4",
  ep: "EP-1",
  strings: "STR-6",
}
