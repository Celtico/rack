import type { PadId } from "../state/pattern"

/** A user sample as kept in the browser: the file's bytes plus its name for the panel. */
export interface StoredSample {
  name: string
  data: ArrayBuffer
}

const DB_NAME = "rack"
const DB_VERSION = 1
const STORE = "samples"

/**
 * Samples live in IndexedDB, keyed by pad, so they survive a reload without
 * bloating the song JSON. No React, no Tone — bytes in, bytes out.
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

export const putSample = (pad: PadId, sample: StoredSample): Promise<void> =>
  withStore<IDBValidKey>("readwrite", (s) => s.put(sample, pad)).then(() => undefined)

export const getSample = (pad: PadId): Promise<StoredSample | undefined> =>
  withStore<StoredSample | undefined>("readonly", (s) => s.get(pad))

export const deleteSample = (pad: PadId): Promise<void> =>
  withStore<undefined>("readwrite", (s) => s.delete(pad)).then(() => undefined)

/** Every stored sample, keyed by pad. Missing pads are simply absent. */
export async function getAllSamples(): Promise<Partial<Record<PadId, StoredSample>>> {
  const [keys, values] = await Promise.all([
    withStore<IDBValidKey[]>("readonly", (s) => s.getAllKeys()),
    withStore<StoredSample[]>("readonly", (s) => s.getAll()),
  ])
  const out: Partial<Record<PadId, StoredSample>> = {}
  keys.forEach((key, i) => {
    const value = values[i]
    if (typeof key === "string" && value) out[key as PadId] = value
  })
  return out
}
