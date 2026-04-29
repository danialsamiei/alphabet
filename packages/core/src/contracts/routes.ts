/**
 * @module contracts/routes
 * @description
 * Single source of truth for Alphabet API routes.
 * منبع یکتای حقیقت برای مسیرهای API در Alphabet.
 *
 * The canonical API version prefix is `/api/alphabet/v1`. All Alphabet endpoints
 * mount under this prefix. Route constants here are the relative paths
 * **below** the prefix (for example, `/context/handshake`). Use
 * {@link fullRoute} to obtain a fully-qualified path that includes the
 * prefix (`/api/alphabet/v1/context/handshake`), and {@link normalizeApiBaseUrl}
 * inside HTTP clients to resolve the base URL ambiguity between callers
 * that pass the bare origin (`https://example.com`), callers that include
 * the legacy `/api` segment (`https://example.com/api`), and callers
 * that already include the canonical prefix
 * (`https://example.com/api/alphabet/v1`).
 *
 * @example
 * import { ALPHABET_ROUTES, fullRoute, normalizeApiBaseUrl } from '@alphabet/core';
 *
 * const base = normalizeApiBaseUrl('https://example.com/');
 * const url  = `${base}${ALPHABET_ROUTES.contextHandshake}`;
 */

// ─── Canonical Version Prefix ────────────────────────────────────────────────

/**
 * Canonical API version prefix for all Alphabet endpoints.
 * پیشوند نسخه‌ای استاندارد برای تمام endpointهای Alphabet.
 *
 * Every documented route lives under this prefix. Clients SHOULD pass
 * an `apiBaseUrl` that either includes this prefix or the bare origin;
 * the legacy `/api` suffix is accepted for backwards compatibility but
 * is considered deprecated.
 */
export const API_VERSION_PREFIX = '/api/alphabet/v1' as const;

/**
 * Legacy prefix accepted by clients for backwards compatibility.
 * @deprecated Use {@link API_VERSION_PREFIX} (`/api/alphabet/v1`) instead.
 */
export const LEGACY_API_PREFIX = '/api' as const;

/**
 * Legacy versioned prefix from the pre-rename `awaf` build.
 * Accepted by {@link normalizeApiBaseUrl} so callers pinned to the
 * old base URL keep working without a code change.
 * @deprecated Use {@link API_VERSION_PREFIX} (`/api/alphabet/v1`) instead.
 */
export const LEGACY_AWAF_API_PREFIX = '/api/awaf/v1' as const;

// ─── Route Constants (relative to API_VERSION_PREFIX) ────────────────────────

/**
 * Relative paths for every Alphabet endpoint, keyed by stable identifier.
 *
 * The values are **relative** to {@link API_VERSION_PREFIX}; combine the two
 * via {@link fullRoute} to get a fully-qualified server path. The keys are
 * stable: clients depend on them, so renaming a key is a breaking change
 * and requires a deprecation alias.
 */
export const ALPHABET_ROUTES = {
  // ── Context Handshake ─────────────────────────────────────────────────────
  /** POST — Six-phase context handshake. */
  contextHandshake: '/context/handshake',
  /** POST — Grant, revoke, upgrade, or downgrade a consent record. */
  contextConsent: '/context/consent',
  /** POST — Persist explicit visitor preferences. */
  contextPreference: '/context/preference',

  // ── Visitor Interaction ───────────────────────────────────────────────────
  /** POST — Text/voice interaction with the Alphabet agent (streaming or not). */
  interact: '/interact',
  /** POST — Voice transcription (multipart/form-data audio upload). */
  voiceTranscribe: '/voice/transcribe',
  /** GET — Ranked context-aware suggestions. */
  suggestions: '/suggestions',

  // ── Alphabet Pulse (formerly Technology Pulse) ────────────────────────────────
  /** GET — List Pulse signals with category/trust filters. */
  technologyPulse: '/technology-pulse',
  /** POST — Generate a Pulse RAG brief. */
  technologyPulseBrief: '/technology-pulse/brief',

  // ── Consent-Aware Memory (formerly Memory Mesh) ───────────────────────────
  /** POST — Store a memory entry. */
  visitorMemoryStore: '/visitor/memory',
  /** GET — Read memory entries. */
  visitorMemoryRead: '/visitor/memory',
  /** DELETE — Erase memory (GDPR Art. 17 / CCPA). */
  visitorMemoryDelete: '/visitor/memory',

  // ── OpenClaw Mesh ─────────────────────────────────────────────────────────
  /** POST — Unified semantic query across consent-aware memory domains. */
  clawQuery: '/claw/query',
  /** POST — Ingest content into consent-aware memory. */
  clawIngest: '/claw/ingest',
  /** POST — Admin audit of memory entries. */
  clawAdminAudit: '/claw/admin/audit',

  // ── Admin ─────────────────────────────────────────────────────────────────
  /** GET — k-anonymous aggregate visitor insights. */
  adminVisitorInsights: '/admin/visitor-insights',
  /** GET — Pulse source catalog management. */
  adminPulseSources: '/admin/technology-pulse/sources',
} as const;

/** Stable key identifying an Alphabet route. */
export type AlphabetRouteKey = keyof typeof ALPHABET_ROUTES;

/** A relative Alphabet route path (no version prefix). */
export type AlphabetRoutePath = (typeof ALPHABET_ROUTES)[AlphabetRouteKey];

/**
 * Implementation status surfaced in the OpenAPI document via
 * `x-alphabet-status`. Kept here so the route table can declare which
 * endpoints are wired in `@alphabet/api` today and which are roadmap.
 */
export type AlphabetRouteStatus = 'implemented' | 'planned';

/**
 * Implementation status per route. Endpoints marked `planned` have a
 * typed request/response in `@alphabet/api` but no server backing.
 */
export const ALPHABET_ROUTE_STATUS: Readonly<Record<AlphabetRouteKey, AlphabetRouteStatus>> = {
  contextHandshake: 'implemented',
  contextConsent: 'implemented',
  contextPreference: 'implemented',
  interact: 'implemented',
  voiceTranscribe: 'implemented',
  suggestions: 'implemented',
  technologyPulse: 'implemented',
  technologyPulseBrief: 'implemented',
  visitorMemoryStore: 'implemented',
  visitorMemoryRead: 'implemented',
  visitorMemoryDelete: 'implemented',
  clawQuery: 'planned',
  clawIngest: 'planned',
  clawAdminAudit: 'planned',
  adminVisitorInsights: 'planned',
  adminPulseSources: 'planned',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the full path for a route, including {@link API_VERSION_PREFIX}.
 *
 * @param key — A {@link AlphabetRouteKey}.
 * @returns The fully-qualified path, for example `/api/alphabet/v1/context/handshake`.
 *
 * @example
 * fullRoute('contextHandshake'); // '/api/alphabet/v1/context/handshake'
 */
export function fullRoute(key: AlphabetRouteKey): string {
  return `${API_VERSION_PREFIX}${ALPHABET_ROUTES[key]}`;
}

/**
 * Normalize a caller-supplied `apiBaseUrl` to a deterministic form that
 * a client can safely concatenate route constants onto. Resolves three
 * historical ambiguities:
 *
 * 1. **Trailing slash** — always stripped.
 * 2. **Missing prefix** — if the URL has no Alphabet prefix, the canonical
 *    `/api/alphabet/v1` is appended.
 * 3. **Legacy `/api` prefix** — preserved as-is for backwards
 *    compatibility (existing callers that pass `https://x/api` keep
 *    working).
 *
 * The function is **idempotent**: calling it twice yields the same
 * result as calling it once.
 *
 * @param rawBase — The caller-supplied base URL.
 * @returns A normalized base URL with no trailing slash and a known
 *          prefix shape.
 *
 * @example
 * normalizeApiBaseUrl('https://x.com/');             // 'https://x.com/api/alphabet/v1'
 * normalizeApiBaseUrl('https://x.com');              // 'https://x.com/api/alphabet/v1'
 * normalizeApiBaseUrl('https://x.com/api');          // 'https://x.com/api'           (legacy preserved)
 * normalizeApiBaseUrl('https://x.com/api/alphabet/v1');  // 'https://x.com/api/alphabet/v1'
 * normalizeApiBaseUrl('https://x.com/api/alphabet/v1/'); // 'https://x.com/api/alphabet/v1'
 */
export function normalizeApiBaseUrl(rawBase: string): string {
  // Strip every trailing slash with a simple character-by-character loop.
  // Avoids any regex backtracking concern on inputs with many repeated `/`.
  let end = rawBase.length;
  while (end > 0 && rawBase.charCodeAt(end - 1) === 47 /* '/' */) {
    end -= 1;
  }
  const trimmed = end === rawBase.length ? rawBase : rawBase.slice(0, end);
  if (trimmed.endsWith(API_VERSION_PREFIX)) return trimmed;
  // Legacy `/api/awaf/v1` prefix from the pre-rename build is preserved
  // so existing callers pinned to that base URL keep working.
  if (trimmed.endsWith(LEGACY_AWAF_API_PREFIX)) return trimmed;
  // Legacy `/api` suffix kept as-is for backwards compatibility.
  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    // Only treat `/api` as legacy when it is a full path segment, not
    // when it is the tail of a hostname like `https://api.example.com`.
    // Hostnames don't contain `/api` as a tail because the URL shape is
    // `scheme://host[/path]`, so requiring at least one `/` before `/api`
    // distinguishes the two.
    const before = trimmed.slice(0, -'/api'.length);
    if (before.includes('/')) return trimmed;
  }
  return `${trimmed}${API_VERSION_PREFIX}`;
}

/**
 * Combine a normalized base URL with a route constant.
 * Useful inside HTTP clients that want a single concatenation helper.
 *
 * @param normalizedBase — Output of {@link normalizeApiBaseUrl}.
 * @param routePath — A route constant from {@link ALPHABET_ROUTES}.
 * @returns The full URL ready for `fetch`.
 */
export function joinRoute(normalizedBase: string, routePath: AlphabetRoutePath): string {
  return `${normalizedBase}${routePath}`;
}
