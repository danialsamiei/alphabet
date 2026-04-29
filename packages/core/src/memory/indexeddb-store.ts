/**
 * @module memory/indexeddb-store
 * @description
 * `IndexedDBStore` — a minimal, dependency-free IndexedDB adapter that
 * implements `MemoryStore`. Roughly 150 LOC of platform IDB. Equivalent
 * in spirit to the popular `idb` package but trimmed to the API surface
 * we actually use.
 *
 * Schema:
 *   - one object store named `records` keyed by the record's `key`.
 *   - records are stored as plain objects (`MemoryRecord` shape) — the
 *     IDB structured-clone algorithm handles the `Uint8Array` fields.
 *
 * **Edge-runtime note.** IndexedDB is **not** available in Cloudflare
 * Workers, Deno Deploy, or Node without `fake-indexeddb`. The engine
 * defaults to `InMemoryStore` and only wires this adapter when the
 * caller opts in (browser / Electron / fake-indexeddb test).
 */

import type { MemoryRecord, MemoryStore } from './types.js';

const STORE_NAME = 'records';

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void =>
      reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function txToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('IDB tx failed'));
    tx.onabort = (): void => reject(tx.error ?? new Error('IDB tx aborted'));
  });
}

/** Options for `IndexedDBStore.open`. */
export interface IndexedDBStoreOptions {
  /** Database name. Default: `alphabet_memory`. */
  readonly databaseName?: string;
  /** Schema version (bump to trigger upgrades). Default: `1`. */
  readonly version?: number;
  /**
   * IndexedDB factory override (default: `globalThis.indexedDB`). Tests
   * inject `fake-indexeddb` here.
   */
  readonly indexedDB?: IDBFactory;
}

/** IndexedDB-backed `MemoryStore`. */
export class IndexedDBStore implements MemoryStore {
  private constructor(private readonly db: IDBDatabase) {}

  /** Open (and upgrade if needed) the underlying database. */
  static async open(options: IndexedDBStoreOptions = {}): Promise<IndexedDBStore> {
    const factory =
      options.indexedDB ??
      (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
    if (factory === undefined) {
      throw new Error('IndexedDB is not available in this runtime');
    }
    const name = options.databaseName ?? 'alphabet_memory';
    const version = options.version ?? 1;
    const open = factory.open(name, version);
    open.onupgradeneeded = (): void => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    const db = await reqToPromise(open);
    return new IndexedDBStore(db);
  }

  async get(key: string): Promise<MemoryRecord | undefined> {
    const tx = this.db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await reqToPromise(store.get(key) as IDBRequest<MemoryRecord | undefined>);
    await txToPromise(tx);
    return result ?? undefined;
  }

  async put(record: MemoryRecord): Promise<void> {
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Structured clone copies Uint8Array bytes — defensive copy is implicit.
    store.put(record);
    await txToPromise(tx);
  }

  async list(prefix: string): Promise<readonly MemoryRecord[]> {
    const tx = this.db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    // Use a key range [prefix, prefix + \uffff] for efficient prefix scan.
    const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`, false, false);
    const out: MemoryRecord[] = [];
    await new Promise<void>((resolve, reject) => {
      const cursorReq = store.openCursor(range);
      cursorReq.onsuccess = (): void => {
        const cursor = cursorReq.result;
        if (cursor === null) {
          resolve();
          return;
        }
        out.push(cursor.value as MemoryRecord);
        cursor.continue();
      };
      cursorReq.onerror = (): void => reject(cursorReq.error ?? new Error('cursor failed'));
    });
    await txToPromise(tx);
    return out;
  }

  async delete(key: string): Promise<void> {
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    await txToPromise(tx);
  }

  async clear(): Promise<void> {
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await txToPromise(tx);
  }

  /** Close the underlying IDB connection (call from teardown). */
  close(): void {
    this.db.close();
  }
}
