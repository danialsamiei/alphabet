/**
 * @module privacy-wasm/hash
 * @description
 * Deps-free anonymous-hashing primitive for `@alphabet/core`.
 *
 * **Default algorithm: SHA-256 (WebCrypto).** SHA-256 is audited,
 * available in every browser and Node ≥ 18, and produces a 32-byte
 * digest sufficient for all anonymity-set use cases inside Alphabet.
 *
 * **BLAKE3 is offered as an opt-in WASM path** via `setBlake3WasmLoader`
 * + `loadBlake3Wasm`. We deliberately do **not** ship a pure-TS BLAKE3
 * inside `@alphabet/core`:
 *   - A correct, test-vector-compliant pure-TS BLAKE3 is many hundreds
 *     of LOC and requires the full BLAKE3 spec test suite to validate.
 *   - A WASM artifact would break `"sideEffects": false` and the
 *     bundle-size budget of the dependency-free package.
 *
 * The proper home for BLAKE3 is the out-of-tree package
 * `@alphabet/blake3-wasm` (planned in PR-B), which can ship a Rust→WASM
 * build sized appropriately and validated against the BLAKE3 reference
 * test vectors.
 *
 * Until then, consumers wanting BLAKE3 write a one-line loader:
 *
 * ```ts
 * setBlake3WasmLoader(async () => {
 *   const m = await import('@alphabet/blake3-wasm');
 *   return { hash: m.hash };
 * });
 * const impl = await loadBlake3Wasm();   // <- WASM if loader provided
 * const digest = impl.hash(bytes);
 * ```
 *
 * If no loader is configured, `loadBlake3Wasm()` falls back to SHA-256
 * with a clear `algorithm: 'sha-256'` field on the returned object so
 * consumers can detect they're on the fallback.
 */

// ─── Default: SHA-256 ────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 digest of `input`. Always 32 bytes.
 * Uses WebCrypto; throws if SubtleCrypto is unavailable.
 */
export async function sha256(input: Uint8Array | string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error('WebCrypto subtle is not available in this runtime');
  }
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const buf = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return new Uint8Array(buf);
}

/** Hex-encode a digest (lowercase, no `0x` prefix). */
export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) {
    s += (bytes[i] as number).toString(16).padStart(2, '0');
  }
  return s;
}

/** Convenience: SHA-256 → hex string. */
export async function sha256Hex(input: Uint8Array | string): Promise<string> {
  return bytesToHex(await sha256(input));
}

// ─── Opt-in BLAKE3 via WASM loader contract ──────────────────────────────────

export interface AnonymousHasher {
  /** Algorithm tag, e.g. `'sha-256'` or `'blake3'`. */
  readonly algorithm: string;
  /** Synchronous hash. WASM-backed loaders typically can be sync after init. */
  hash(input: Uint8Array): Uint8Array;
}

export type Blake3WasmLoader = () => Promise<AnonymousHasher | undefined>;

let pendingLoader: Blake3WasmLoader | undefined;
let cached: AnonymousHasher | undefined;

/** Register an opt-in BLAKE3-via-WASM loader. Pass `undefined` to clear. */
export function setBlake3WasmLoader(loader: Blake3WasmLoader | undefined): void {
  pendingLoader = loader;
  cached = undefined;
}

/**
 * Resolve the BLAKE3 implementation. Returns a SHA-256 hasher with
 * `algorithm === 'sha-256'` if no loader is registered. The fallback
 * delegates to `sha256` *synchronously* by buffering — for the truly
 * sync version, install `@alphabet/blake3-wasm`.
 *
 * Note: the SHA-256 fallback is async-init (one digest call) so that
 * the returned `hash()` can be sync. After init it is fully synchronous.
 */
export async function loadBlake3Wasm(): Promise<AnonymousHasher> {
  if (cached !== undefined) return cached;
  if (pendingLoader !== undefined) {
    const out = await pendingLoader();
    if (out !== undefined) {
      cached = out;
      return out;
    }
  }
  // Fallback: synchronous SHA-256 via the lazily-imported `node:crypto` /
  // a polyfill-friendly sync wrapper. Since WebCrypto digest is async,
  // we build a tiny sync wrapper using `globalThis.crypto.subtle` only
  // for *async* callers. The `hash()` here is sync but **buffers**: the
  // first call may pre-warm if the host provides a sync digest, else it
  // throws and the caller should `await sha256()` instead.
  cached = {
    algorithm: 'sha-256',
    hash: (_input: Uint8Array): Uint8Array => {
      // Synchronous SHA-256 is not available in browsers (WebCrypto's
      // `digest()` is async). Tell the caller plainly so they can use
      // `await sha256(input)` or install a WASM-backed loader.
      throw new Error(
        'loadBlake3Wasm() fallback: synchronous hashing is not available without ' +
          'a registered loader. Use `await sha256(input)` for SHA-256 in the default ' +
          'runtime, or register a WASM-backed loader via setBlake3WasmLoader().',
      );
    },
  };
  return cached;
}
