/**
 * @file anonymity-set.test.ts
 */

import { describe, it, expect } from 'vitest';
import { AnonymitySet } from './anonymity-set.js';

describe('AnonymitySet / basic counting', () => {
  it('estimate() of an unseen key is 0', async () => {
    const s = new AnonymitySet({ size: 256, numHashes: 3 });
    expect(await s.estimate('unseen')).toBe(0);
  });

  it('add+estimate increments min counter', async () => {
    const s = new AnonymitySet({ size: 256, numHashes: 3 });
    await s.add('alice');
    expect(await s.estimate('alice')).toBe(1);
    await s.add('alice');
    expect(await s.estimate('alice')).toBe(2);
  });

  it('insertedCount tracks total adds', async () => {
    const s = new AnonymitySet();
    await s.add('a');
    await s.add('b');
    await s.add('a');
    expect(s.insertedCount()).toBe(3);
  });

  it('reset() clears counters', async () => {
    const s = new AnonymitySet();
    await s.add('a');
    s.reset();
    expect(await s.estimate('a')).toBe(0);
    expect(s.insertedCount()).toBe(0);
  });
});

describe('AnonymitySet / k-anonymity gate', () => {
  it('gate(k=5) returns false until at least 5 inserts of the same key', async () => {
    const s = new AnonymitySet({ size: 1024, numHashes: 4, k: 5 });
    for (let i = 0; i < 4; i += 1) {
      await s.add('cohortA');
      expect(await s.gate('cohortA')).toBe(false);
    }
    await s.add('cohortA');
    expect(await s.gate('cohortA')).toBe(true);
  });

  it('gate respects an explicit kOverride', async () => {
    const s = new AnonymitySet({ size: 1024, numHashes: 4 });
    await s.add('cohortB');
    await s.add('cohortB');
    expect(await s.gate('cohortB', 2)).toBe(true);
    expect(await s.gate('cohortB', 3)).toBe(false);
  });

  it('saturates at COUNTER_MAX (15) without overflow', async () => {
    const s = new AnonymitySet({ size: 1024, numHashes: 4 });
    for (let i = 0; i < 50; i += 1) await s.add('hot');
    expect(await s.estimate('hot')).toBe(15);
  });
});

describe('AnonymitySet / remove', () => {
  it('decrements counters; 0 is the floor', async () => {
    const s = new AnonymitySet();
    await s.add('x');
    await s.add('x');
    await s.remove('x');
    expect(await s.estimate('x')).toBe(1);
    await s.remove('x');
    await s.remove('x'); // already at 0
    expect(await s.estimate('x')).toBe(0);
  });
});

describe('AnonymitySet / capacity bounds', () => {
  it('enforces minimum size', () => {
    const s = new AnonymitySet({ size: 1 });
    expect(s.capacity()).toBeGreaterThanOrEqual(64);
  });

  it('clamps numHashes to [1, 8]', async () => {
    const s = new AnonymitySet({ numHashes: 99 });
    // Indirectly verified: add() does not throw.
    await expect(s.add('x')).resolves.toBeUndefined();
  });
});

describe('AnonymitySet / injected hashFn', () => {
  it('uses the provided hash function', async () => {
    let calls = 0;
    const s = new AnonymitySet({
      hashFn: (input) => {
        calls += 1;
        // Trivial deterministic hash — not for production.
        const out = new Uint8Array(32);
        for (let i = 0; i < input.length; i += 1) out[i % 32] ^= input[i] as number;
        return out;
      },
    });
    await s.add('hello');
    expect(calls).toBeGreaterThan(0);
  });
});
