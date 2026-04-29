/**
 * @file indexeddb-store.test.ts
 * @description Uses `fake-indexeddb` for a real IDB exercise without a browser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBStore } from './indexeddb-store.js';
import type { MemoryRecord } from './types.js';

function rec(key: string, value: string): MemoryRecord {
  return {
    key,
    value: new TextEncoder().encode(value),
    receipt: 'aaaa.bbbb',
    ts: 1,
    format: 'plain',
  };
}

let dbCounter = 0;
async function freshStore(): Promise<IndexedDBStore> {
  dbCounter += 1;
  return IndexedDBStore.open({ databaseName: `idb_test_${dbCounter}` });
}

describe('IndexedDBStore', () => {
  beforeAll(async () => {
    // Sanity: indexedDB is patched in by `fake-indexeddb/auto`.
    expect(typeof globalThis.indexedDB).toBe('object');
  });

  it('opens a database and round-trips a record', async () => {
    const s = await freshStore();
    await s.put(rec('site_specific\u0001theme', 'dark'));
    const out = await s.get('site_specific\u0001theme');
    expect(out).toBeDefined();
    if (out !== undefined) {
      expect(new TextDecoder().decode(out.value)).toBe('dark');
    }
    s.close();
  });

  it('list scans a prefix range', async () => {
    const s = await freshStore();
    await s.put(rec('visitor\u0001a', '1'));
    await s.put(rec('visitor\u0001b', '2'));
    await s.put(rec('site_specific\u0001x', '3'));
    const out = await s.list('visitor\u0001');
    expect(out.length).toBe(2);
    s.close();
  });

  it('delete + clear behave as expected', async () => {
    const s = await freshStore();
    await s.put(rec('a', '1'));
    await s.put(rec('b', '2'));
    await s.delete('a');
    expect(await s.get('a')).toBeUndefined();
    await s.clear();
    expect(await s.get('b')).toBeUndefined();
    s.close();
  });
});
