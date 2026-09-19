import { getAllFromStore, STORES, withStore } from "../state/db"

/** A user sample as kept in the browser: the file's bytes plus its name for the panel. */
export interface StoredSample {
  name: string
  data: ArrayBuffer
  /** The file's media type — a video needs it to play; samples never set it. */
  type?: string
  /** A recording from the microphone: when it was taken, and for a loop, its bars and tempo. */
  takenAt?: number
  bars?: number
  bpm?: number
}

/** Keys of the microphone's takes — every loop and clip recorded, listed in the MIC-1 panel. */
const TAKE_PREFIX = "take:"
const takeKey = (takenAt: number) => `${TAKE_PREFIX}${takenAt}`
const isTakeKey = (key: string): boolean => key.startsWith(TAKE_PREFIX)

/** One recording as the panel lists it: its key and what is known about it, no bytes. */
export interface Take {
  key: string
  name: string
  takenAt: number
  bars?: number
  bpm?: number
}

/** Every take, newest first. */
export async function listTakes(): Promise<Take[]> {
  const all = await getAllSamples()
  return Object.entries(all)
    .filter(([key]) => isTakeKey(key))
    .map(([key, s]) => ({
      key,
      name: s.name,
      takenAt: s.takenAt ?? 0,
      ...(s.bars !== undefined ? { bars: s.bars } : {}),
      ...(s.bpm !== undefined ? { bpm: s.bpm } : {}),
    }))
    .sort((a, b) => b.takenAt - a.takenAt)
}

/** Keep a recording in the list; returns its key. */
export async function saveTake(sample: Omit<StoredSample, "takenAt">): Promise<string> {
  const takenAt = Date.now()
  const key = takeKey(takenAt)
  await putSample(key, { ...sample, takenAt })
  return key
}

/** Storage key of one pad of one sampler instance. */
export const sampleKey = (instanceId: string, pad: string) => `${instanceId}:${pad}`

/**
 * Samples live in IndexedDB (the rack's shared database, `state/db.ts`), keyed
 * by `${instance}:${pad}`, so they survive a reload without bloating the song
 * JSON. No React, no Tone — bytes in, bytes out.
 */
export const putSample = (key: string, sample: StoredSample): Promise<void> =>
  withStore<IDBValidKey>(STORES.samples, "readwrite", (s) => s.put(sample, key)).then(
    () => undefined,
  )

export const getSample = (key: string): Promise<StoredSample | undefined> =>
  withStore<StoredSample | undefined>(STORES.samples, "readonly", (s) => s.get(key))

export const deleteSample = (key: string): Promise<void> =>
  withStore<undefined>(STORES.samples, "readwrite", (s) => s.delete(key)).then(() => undefined)

/** Every stored sample, keyed as stored. */
export const getAllSamples = (): Promise<Record<string, StoredSample>> =>
  getAllFromStore<StoredSample>(STORES.samples)
