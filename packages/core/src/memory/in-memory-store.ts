/**
 * @module memory/in-memory-store
 * @description
 * `InMemoryStore` — a `Map`-backed implementation of `MemoryStore`. Used
 * for tests, and for runtimes (Workers, Deno) where there is no
 * IndexedDB or no persistence is wanted.
 */

import type { MemoryRecord, MemoryStore } from './types.js';

/** Synchronous Map-backed memory store. */
export class InMemoryStore implements MemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  async get(key: string): Promise<MemoryRecord | undefined> {
    return this.records.get(key);
  }

  async put(record: MemoryRecord): Promise<void> {
    // Defensive copy of `value` and `iv` so callers cannot mutate stored bytes.
    const stored: MemoryRecord = record.iv === undefined
      ? {
          key: record.key,
          value: new Uint8Array(record.value),
          receipt: record.receipt,
          ts: record.ts,
          format: record.format,
        }
      : {
          key: record.key,
          value: new Uint8Array(record.value),
          receipt: record.receipt,
          ts: record.ts,
          format: record.format,
          iv: new Uint8Array(record.iv),
        };
    this.records.set(record.key, stored);
  }

  async list(prefix: string): Promise<readonly MemoryRecord[]> {
    const out: MemoryRecord[] = [];
    for (const [k, v] of this.records.entries()) {
      if (k.startsWith(prefix)) out.push(v);
    }
    return out;
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  /** Test helper: count of stored records. */
  size(): number {
    return this.records.size;
  }
}
