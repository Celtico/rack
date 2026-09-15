import { getAllFromStore, STORES, withStore } from "../state/db"

/** A user sample as kept in the browser: the file's bytes plus its name for the panel. */
export interface StoredSample {
  name: string
  data: ArrayBuffer
  /** The file's media type — a video needs it to play; samples never set it. */
  type?: string
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
