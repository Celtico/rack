/** Mixer channels — one per sound module. The engine builds one strip for each. */
export const CHANNEL_IDS = ["drums", "synth"] as const
export type ChannelId = (typeof CHANNEL_IDS)[number]

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  drums: "DR-4",
  synth: "MONO-1",
}
