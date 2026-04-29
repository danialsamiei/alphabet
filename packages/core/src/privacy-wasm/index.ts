/**
 * @module privacy-wasm
 * @description
 * Anonymous-hashing primitives + k-anonymity gate for `@alphabet/core`.
 *
 * **No WASM is bundled.** The default algorithm is WebCrypto **SHA-256**.
 * Consumers wanting BLAKE3 can register a WASM loader via
 * `setBlake3WasmLoader`; the actual WASM artifact lives out of tree
 * (planned `@alphabet/blake3-wasm`, PR-B). This keeps `@alphabet/core`
 * dependency-free, side-effect-free, and within bundle-size budget.
 */

export {
  sha256,
  sha256Hex,
  bytesToHex,
  setBlake3WasmLoader,
  loadBlake3Wasm,
  type AnonymousHasher,
  type Blake3WasmLoader,
} from './hash.js';

export { AnonymitySet, type AnonymitySetOptions } from './anonymity-set.js';
