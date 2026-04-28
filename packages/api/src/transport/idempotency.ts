/**
 * @module transport/idempotency
 * @description
 * Auto-generated `Idempotency-Key` headers for unsafe HTTP verbs.
 *
 * AWAF uses retry on 5xx and 429, which means a `POST` or `DELETE` may be
 * delivered to the server more than once. The server is expected to dedupe
 * by `Idempotency-Key`; this module produces one per **logical** request
 * (so all retries of the same call carry the same key, but two distinct
 * calls do not collide).
 *
 * Format: `awaf_<26-char ULID-like>`. We do **not** depend on `crypto.randomUUID`
 * because some edge runtimes lack it; instead we use `crypto.getRandomValues`
 * (universally available in Node 20+, browsers, edge) and fall back to
 * `Math.random` only as a last resort. The key is **opaque** — the server
 * MUST treat it as a string.
 */

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const;

/**
 * Generate a Crockford-base32 random suffix of the given length using
 * `crypto.getRandomValues`. Falls back to `Math.random` if `crypto` is
 * unavailable.
 */
function randomBase32(length: number): string {
  const cryptoLike = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
    .crypto;
  let chars = '';
  if (cryptoLike?.getRandomValues !== undefined) {
    const bytes = new Uint8Array(length);
    cryptoLike.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      const byte = bytes[i] as number;
      chars += ULID_ALPHABET[byte % 32];
    }
  } else {
    for (let i = 0; i < length; i++) {
      chars += ULID_ALPHABET[Math.floor(Math.random() * 32)];
    }
  }
  return chars;
}

/**
 * Generate an idempotency key for one logical request.
 *
 * @returns A 32-char string of the form `awaf_<26 base32 chars>`.
 */
export function generateIdempotencyKey(): string {
  return `awaf_${randomBase32(26)}`;
}

/** HTTP methods considered "unsafe" per RFC 9110 §9.2.1. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Should the given HTTP method receive an auto-generated idempotency key?
 *
 * @param method - The HTTP method, case-insensitive.
 */
export function isUnsafeMethod(method: string | undefined): boolean {
  if (method === undefined) return false;
  return UNSAFE_METHODS.has(method.toUpperCase());
}

/**
 * Return a copy of the given `HeadersInit` with an `Idempotency-Key` set,
 * unless one is already present. No-op for safe methods.
 *
 * @param headers - Existing headers (any of the three accepted shapes).
 * @param method  - The HTTP method.
 * @param keyFactory - Override for testing.
 * @returns A new `Headers` object with the key added, or the original when
 *          no change was made.
 */
export function withIdempotencyKey(
  headers: HeadersInit | undefined,
  method: string | undefined,
  keyFactory: () => string = generateIdempotencyKey,
): Headers {
  const result = new Headers(headers);
  if (!isUnsafeMethod(method)) return result;
  if (result.has('Idempotency-Key')) return result;
  result.set('Idempotency-Key', keyFactory());
  return result;
}
