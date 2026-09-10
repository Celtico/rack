/** Mixer channels — one per sound module. The engine builds one strip for each. */
export const CHANNEL_IDS = ["drums", "perc", "synth", "bass"] as const
export type ChannelId = (typeof CHANNEL_IDS)[number]

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  drums: "DR-4",
  perc: "PERC-6",
  synth: "MONO-1",
  bass: "BASS-2",
}
