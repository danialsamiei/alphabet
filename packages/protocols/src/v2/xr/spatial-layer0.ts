/**
 * @module @alphabet/protocols/v2/xr/spatial-layer0
 * @description
 * Minimal binding for the **Spatial Web Layer 0** — the foundational
 * "spatial domain" layer in IEEE P2874-style architectures. The
 * orchestrator never speaks any specific Spatial Web wire format
 * directly; instead, it depends on this `SpatialLayer0Adapter`
 * interface and ships an in-memory default that obeys consent tiers.
 *
 * Why an interface?
 *   • Spatial Web reference implementations are still maturing; we
 *     don't want the protocols package to take a hard runtime
 *     dependency on any of them.
 *   • Edge runtimes (Vercel Edge, Cloudflare Workers) cannot reach the
 *     network at module-init time, so an in-memory default is the
 *     safest baseline.
 *
 * Implementations supplied by integrators MUST:
 *   1. Refuse `world`-scoped writes when the privacy posture is
 *      `on-device-only`.
 *   2. Treat `requiredTier === 'NO_MEMORY' | 'ANONYMOUS'` as a hard
 *      refusal — Layer-0 anchors are personal-context data.
 *   3. Never log PII; metadata fields are caller-supplied and may be
 *      passed through verbatim provided the caller has redacted them.
 */

import { ok, err, type Result } from '@alphabet/core';
import { protocolError, type AlphabetProtocolError } from '../../errors/index.js';
import type { XRSpatialAnchor, XRPrivacyPosture } from './types.js';

// ─── Adapter contract ────────────────────────────────────────────────────────

/**
 * Spatial Web Layer 0 adapter contract. Two-method surface:
 *   • `attach(anchor, posture)` — store an anchor.
 *   • `revoke(anchorId)` — remove an anchor (and any persisted copy).
 *   • `list()` — read the currently stored anchors. The orchestrator
 *     uses this for admin UIs and tests; production consumers may
 *     short-circuit and not implement it.
 */
export interface SpatialLayer0Adapter {
  /** Stable adapter id — surfaced in audit logs. No PII. */
  readonly id: string;
  /**
   * Persist an anchor. Implementations must enforce the privacy
   * posture: `on-device-only` rejects `world`-scoped anchors;
   * `session-ephemeral` may keep them in memory only;
   * `persistent-with-proof` is the only posture that allows durable
   * storage and SHOULD verify a consent proof out of band.
   */
  attach(
    anchor: XRSpatialAnchor,
    posture: XRPrivacyPosture,
  ): Promise<Result<void, AlphabetProtocolError>>;
  /** Revoke an anchor. Idempotent — missing anchors return ok. */
  revoke(anchorId: string): Promise<Result<void, AlphabetProtocolError>>;
  /** Snapshot of currently stored anchors. */
  list(): Promise<readonly XRSpatialAnchor[]>;
}

// ─── In-memory default ───────────────────────────────────────────────────────

/**
 * Options for the in-memory adapter. Disallowing `world` scope under a
 * given posture is enforced regardless of these options.
 */
export interface InMemorySpatialLayer0Options {
  /** Maximum number of anchors before the oldest is evicted. */
  readonly maxAnchors?: number;
  /** Adapter id surfaced via `id`; defaults to 'in-memory-spatial-layer0'. */
  readonly id?: string;
}

const DEFAULT_MAX_ANCHORS = 64;

/**
 * In-memory `SpatialLayer0Adapter`. **Never reaches the network.**
 * Useful for tests, demos, edge-runtime fallbacks, and any deployment
 * that has not yet bound a real Spatial Web reference implementation.
 *
 * @example
 * const adapter = createInMemorySpatialLayer0Adapter();
 * const r = await adapter.attach({
 *   id: 'desk-1',
 *   pose: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
 *   scope: 'local',
 *   requiredTier: 'CONSENTED',
 * }, 'session-ephemeral');
 * if (!r.success) throw r.error;
 */
export function createInMemorySpatialLayer0Adapter(
  options: InMemorySpatialLayer0Options = {},
): SpatialLayer0Adapter {
  const max = Math.max(1, options.maxAnchors ?? DEFAULT_MAX_ANCHORS);
  const id = options.id ?? 'in-memory-spatial-layer0';
  const store = new Map<string, XRSpatialAnchor>();

  return {
    id,
    async attach(anchor, posture) {
      // World-scoped writes are gated on posture.
      if (anchor.scope === 'world' && posture === 'on-device-only') {
        return err(
          protocolError(
            'CONSENT_INSUFFICIENT',
            'World-scoped anchors require session-ephemeral or persistent-with-proof posture',
            { anchorId: anchor.id, scope: anchor.scope, posture },
          ),
        );
      }
      // Layer-0 data is always personal-context; refuse below CONSENTED.
      // Per module docs, both NO_MEMORY and ANONYMOUS are hard refusals —
      // Spatial Web Layer 0 anchors carry pose data that is personal context
      // and must only be persisted once the visitor has explicitly consented.
      if (anchor.requiredTier === 'NO_MEMORY' || anchor.requiredTier === 'ANONYMOUS') {
        return err(
          protocolError(
            'CONSENT_INSUFFICIENT',
            'Spatial Layer 0 anchors require at least CONSENTED tier',
            { anchorId: anchor.id, requiredTier: anchor.requiredTier },
          ),
        );
      }
      // FIFO eviction.
      if (!store.has(anchor.id) && store.size >= max) {
        const oldest = store.keys().next().value;
        if (typeof oldest === 'string') store.delete(oldest);
      }
      store.set(anchor.id, anchor);
      return ok(undefined);
    },
    async revoke(anchorId) {
      store.delete(anchorId);
      return ok(undefined);
    },
    async list() {
      return [...store.values()];
    },
  };
}
