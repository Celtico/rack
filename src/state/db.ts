/**
 * The rack's IndexedDB: one database, one object store per thing kept in the
 * browser — sample bytes and saved songs. Opened per request and closed after,
 * so nothing holds the connection. No React, no Tone.
 */
const DB_NAME = "rack"
/** Bump when a store is added; `onupgradeneeded` creates whatever is missing. */
const DB_VERSION = 2

export const STORES = {
  samples: "samples",
  songs: "songs",
} as const
export type StoreName = (typeof STORES)[keyof typeof STORES]

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB: open failed"))
  })
}

/** Run one request against a store and resolve with its result. */
export function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = run(tx.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error("IndexedDB: request failed"))
        tx.oncomplete = () => db.close()
      }),
  )
}

/** Every record of a store, keyed as stored (string keys only). */
export async function getAllFromStore<T>(store: StoreName): Promise<Record<string, T>> {
  const [keys, values] = await Promise.all([
    withStore<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys()),
    withStore<T[]>(store, "readonly", (s) => s.getAll()),
  ])
  const out: Record<string, T> = {}
  keys.forEach((key, i) => {
    const value = values[i]
    if (typeof key === "string" && value !== undefined) out[key] = value
  })
  return out
}
