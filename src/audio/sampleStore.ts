/** A user sample as kept in the browser: the file's bytes plus its name for the panel. */
export interface StoredSample {
  name: string
  data: ArrayBuffer
}

const DB_NAME = "rack"
const DB_VERSION = 1
const STORE = "samples"

/** Storage key of one pad of one sampler instance. */
export const sampleKey = (instanceId: string, pad: string) => `${instanceId}:${pad}`

/**
 * Samples live in IndexedDB, keyed by `${instance}:${pad}`, so they survive a
 * reload without bloating the song JSON. No React, no Tone — bytes in, bytes out.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB: open failed"))
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = run(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error("IndexedDB: request failed"))
        tx.oncomplete = () => db.close()
      }),
  )
}

export const putSample = (key: string, sample: StoredSample): Promise<void> =>
  withStore<IDBValidKey>("readwrite", (s) => s.put(sample, key)).then(() => undefined)

export const getSample = (key: string): Promise<StoredSample | undefined> =>
  withStore<StoredSample | undefined>("readonly", (s) => s.get(key))

export const deleteSample = (key: string): Promise<void> =>
  withStore<undefined>("readwrite", (s) => s.delete(key)).then(() => undefined)

/** Every stored sample, keyed as stored. */
export async function getAllSamples(): Promise<Record<string, StoredSample>> {
  const [keys, values] = await Promise.all([
    withStore<IDBValidKey[]>("readonly", (s) => s.getAllKeys()),
    withStore<StoredSample[]>("readonly", (s) => s.getAll()),
  ])
  const out: Record<string, StoredSample> = {}
  keys.forEach((key, i) => {
    const value = values[i]
    if (typeof key === "string" && value) out[key] = value
  })
  return out
}
