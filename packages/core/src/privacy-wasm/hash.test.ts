/**
 * @file hash.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  sha256,
  sha256Hex,
  bytesToHex,
  setBlake3WasmLoader,
  loadBlake3Wasm,
  type AnonymousHasher,
} from './hash.js';

describe('sha256', () => {
  it('produces a 32-byte digest', async () => {
    const out = await sha256(new Uint8Array(0));
    expect(out.byteLength).toBe(32);
  });

  it('matches the known test vector for "abc"', async () => {
    const hex = await sha256Hex('abc');
    expect(hex).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the empty-string vector', async () => {
    const hex = await sha256Hex('');
    expect(hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('bytesToHex round-trips a known digest', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(bytesToHex(bytes)).toBe('deadbeef');
  });
});

describe('loadBlake3Wasm — opt-in WASM loader contract', () => {
  afterEach(() => setBlake3WasmLoader(undefined));

  it('returns a SHA-256 fallback hasher when no loader is registered', async () => {
    const h = await loadBlake3Wasm();
    expect(h.algorithm).toBe('sha-256');
  });

  it('uses the registered loader when present', async () => {
    const fake: AnonymousHasher = {
      algorithm: 'blake3',
      hash: () => new Uint8Array([1, 2, 3]),
    };
    setBlake3WasmLoader(async () => fake);
    const h = await loadBlake3Wasm();
    expect(h.algorithm).toBe('blake3');
    expect(Array.from(h.hash(new Uint8Array(0)))).toEqual([1, 2, 3]);
  });

  it('falls back to SHA-256 when the loader returns undefined', async () => {
    setBlake3WasmLoader(async () => undefined);
    const h = await loadBlake3Wasm();
    expect(h.algorithm).toBe('sha-256');
  });

  it('caches the resolved hasher across calls', async () => {
    let calls = 0;
    setBlake3WasmLoader(async () => {
      calls += 1;
      return {
        algorithm: 'blake3',
        hash: () => new Uint8Array(0),
      };
    });
    await loadBlake3Wasm();
    await loadBlake3Wasm();
    expect(calls).toBe(1);
  });
});
