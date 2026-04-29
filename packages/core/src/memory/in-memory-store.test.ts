/**
 * @file in-memory-store.test.ts
 */

import { describe, it, expect } from 'vitest';
import { InMemoryStore } from './in-memory-store.js';
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

describe('InMemoryStore', () => {
  it('round-trips a record', async () => {
    const s = new InMemoryStore();
    await s.put(rec('site_specific\u0001theme', 'dark'));
    const out = await s.get('site_specific\u0001theme');
    expect(out).toBeDefined();
    if (out !== undefined) {
      expect(new TextDecoder().decode(out.value)).toBe('dark');
    }
  });

  it('list filters by prefix', async () => {
    const s = new InMemoryStore();
    await s.put(rec('site_specific\u0001a', '1'));
    await s.put(rec('site_specific\u0001b', '2'));
    await s.put(rec('visitor\u0001x', '3'));
    const out = await s.list('site_specific\u0001');
    expect(out.length).toBe(2);
  });

  it('delete removes a single key', async () => {
    const s = new InMemoryStore();
    await s.put(rec('a', '1'));
    await s.put(rec('b', '2'));
    await s.delete('a');
    expect(await s.get('a')).toBeUndefined();
    expect(await s.get('b')).toBeDefined();
  });

  it('clear wipes everything', async () => {
    const s = new InMemoryStore();
    await s.put(rec('a', '1'));
    await s.put(rec('b', '2'));
    await s.clear();
    expect(s.size()).toBe(0);
  });

  it('defensive copy prevents external mutation', async () => {
    const s = new InMemoryStore();
    const r = rec('a', 'orig');
    await s.put(r);
    r.value[0] = 0;
    const out = await s.get('a');
    expect(out).toBeDefined();
    if (out !== undefined) {
      expect(new TextDecoder().decode(out.value)).toBe('orig');
    }
  });
});
