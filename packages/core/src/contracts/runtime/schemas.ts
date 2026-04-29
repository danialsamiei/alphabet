/**
 * @module contracts/runtime/schemas
 * @description
 * Hand-authored runtime schemas for the Alphabet transport envelope and the
 * handshake payload. These mirror the TypeScript interfaces in
 * `../../types/api.ts` and `../../types/base.ts` exactly — they are the
 * **runtime** half of the type contract that lets clients reject malformed
 * server responses **as values, not exceptions**.
 *
 * Rules of thumb when extending these schemas:
 * - Mirror the TypeScript interfaces. If a field is `readonly` and required
 *   in TS, it is required here. If it is optional in TS (`field?: T`), wrap
 *   it in `v.optional(...)` here.
 * - Keep schemas dependency-free. Anything that requires `zod`/`valibot`
 *   belongs in the optional adapter modules.
 * - Never validate the **value** of an ID brand — only its `string`-ness.
 *   Brand semantics belong in `../../types/brands.ts`.
 */

import { v, type Infer } from './structural.js';
import type { Validator } from './validator.js';
import type { AlphabetRequest, AlphabetResponse } from '../../types/api.js';

// ─── Building blocks ──────────────────────────────────────────────────────────

/**
 * Validator for the {@link AlphabetError} shape (no PII guarantees, just shape).
 * `details` is `unknown` because consumers stuff arbitrary diagnostic fields
 * in there; `code` and `message` are required.
 */
export const alphabetErrorSchema = v.object({
  code: v.string(),
  message: v.string(),
  details: v.optional(v.record(v.unknown())),
});

/** Validator for {@link ResponseMeta}. */
export const responseMetaSchema = v.object({
  processingTimeMs: v.number(),
  rateLimitResetSec: v.optional(v.number()),
  rateLimitRemaining: v.optional(v.number()),
  respondedAt: v.string(),
});

/** Consent tiers (string enum mirror). */
export const consentTierSchema = v.enum([
  'NO_MEMORY',
  'ANONYMOUS',
  'CONSENTED',
  'ENRICHED',
] as const);

/** Protocol types (string enum mirror). */
export const protocolTypeSchema = v.enum(['MCP', 'A2A', 'QR', 'API'] as const);

/** Capability layers (string enum mirror). */
export const capabilityLayerSchema = v.enum([
  'R3F',
  'CSS3D',
  'CANVAS2D',
  'STATIC',
  'TEXT_ONLY',
] as const);

// ─── AlphabetRequest envelope ────────────────────────────────────────────────────

/**
 * Validator for {@link AlphabetRequest} with an arbitrary payload schema.
 *
 * @example
 * const handshakeRequestSchema = alphabetRequestSchema(handshakePayloadSchema);
 */
export function alphabetRequestSchema<T>(
  payloadSchema: Validator<T>,
): Validator<AlphabetRequest<T>> {
  // Cast: the structural inference is structurally identical to AlphabetRequest<T>,
  // but TypeScript cannot connect the brand types (VisitorId, SessionId,
  // RequestId) to plain `string` without adapter helpers. Brand validation
  // happens at construction time in `types/brands.ts`; the wire format is
  // raw `string`.
  return v.object({
    protocol: protocolTypeSchema,
    endpoint: v.string(),
    visitorId: v.string(),
    sessionId: v.string(),
    consentTier: consentTierSchema,
    payload: payloadSchema,
    timestamp: v.string(),
    requestId: v.string(),
  }) as unknown as Validator<AlphabetRequest<T>>;
}

/**
 * Validator for {@link AlphabetResponse} with an arbitrary `data` schema.
 *
 * Both `data` and `error` are optional at the wire level: a response either
 * carries `data` (success) or `error` (failure). Higher-level code in the
 * client checks the `success` flag and chooses the right branch.
 */
export function alphabetResponseSchema<T>(
  dataSchema: Validator<T>,
): Validator<AlphabetResponse<T>> {
  return v.object({
    requestId: v.string(),
    success: v.boolean(),
    data: v.optional(dataSchema),
    error: v.optional(alphabetErrorSchema),
    meta: responseMetaSchema,
  }) as unknown as Validator<AlphabetResponse<T>>;
}

// ─── Handshake payload schemas ───────────────────────────────────────────────

/**
 * Validator for the **wire shape** of the handshake request payload.
 * Matches `HandshakeRequestPayload` in `types/api.ts`. We keep this separate
 * from the full `AlphabetRequest` envelope because some transports (notably the
 * legacy `HandshakeClient`) post the payload directly without an envelope.
 *
 * Only fields actually inspected by the Alphabet SDK are validated — clients
 * may send additional vendor-specific signals which we ignore but do not
 * reject. The schema therefore is **not** marked `.strict()`.
 */
export const handshakePayloadSchema = v.object({
  language: v.optional(v.string()),
  timezone: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  viewport: v.optional(
    v.object({
      width: v.number(),
      height: v.number(),
      dpr: v.optional(v.number()),
    }),
  ),
  capabilities: v.optional(
    v.object({
      webgl2: v.optional(v.boolean()),
      canvas2d: v.optional(v.boolean()),
      hardwareConcurrency: v.optional(v.number()),
      deviceMemory: v.optional(v.number()),
    }),
  ),
  preferences: v.optional(
    v.object({
      reducedMotion: v.optional(v.boolean()),
      highContrast: v.optional(v.boolean()),
      colorScheme: v.optional(v.enum(['light', 'dark', 'no-preference'] as const)),
    }),
  ),
  privacy: v.optional(
    v.object({
      doNotTrack: v.optional(v.boolean()),
      globalPrivacyControl: v.optional(v.boolean()),
    }),
  ),
  geo: v.optional(
    v.object({
      country: v.optional(v.string()),
      region: v.optional(v.string()),
      timezone: v.optional(v.string()),
    }),
  ),
});

/** Inferred type of the handshake payload, useful in tests. */
export type HandshakePayloadShape = Infer<typeof handshakePayloadSchema>;

/**
 * Validator for the handshake **result** (server → client).
 *
 * This intentionally validates only the fields documented in the OpenAPI
 * spec for `/api/alphabet/v1/context/handshake`. Servers MAY include additional
 * fields (e.g. for experiments) which the client passes through unchanged.
 */
export const handshakeResultSchema = v.object({
  visitorId: v.string(),
  sessionId: v.string(),
  selectedLayer: capabilityLayerSchema,
  uiConfig: v.object({
    locale: v.string(),
    direction: v.enum(['ltr', 'rtl'] as const),
    theme: v.optional(v.string()),
    heroCopy: v.optional(v.string()),
    consentRequired: v.optional(v.boolean()),
    cssVariables: v.optional(v.record(v.string())),
  }),
  privacyMode: v.optional(v.enum(['standard', 'strict', 'public'] as const)),
});

/** Inferred type of the handshake result, useful in tests. */
export type HandshakeResultShape = Infer<typeof handshakeResultSchema>;
