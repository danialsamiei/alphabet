/**
 * @module @alphabet/protocols/normalizers
 * @description
 * Pure helper functions that convert raw protocol input into normalized
 * Alphabet contract objects, and validate consent/memory permissions.
 *
 * These are the canonical implementations: every adapter must use them
 * rather than re-implementing the consent ladder locally.
 */

import {
  CONSENT_TIER_LEVEL,
  canPersonalize,
  canStoreMemory,
  canUseAnalytics,
  canUsePreciseGeo,
  hasPrivacySignal,
  ok,
  err,
  type ConsentTier,
  type MemoryDomain,
  type PrivacySignals,
  type Result,
} from '@alphabet/core';
import {
  protocolError,
  type AlphabetProtocolError,
} from '../errors/index.js';
import type {
  AlphabetConsentOperation,
  AlphabetConsentScope,
  AlphabetMemoryPermission,
  AlphabetToolContext,
} from '../contract.js';

// ─── Consent Scope ───────────────────────────────────────────────────────────

/**
 * Build a default consent scope from a tier. `respectsPrivacySignals`
 * defaults to `true` (the safe choice). Operations and memory domains are
 * empty unless explicitly provided.
 */
export function makeConsentScope(
  tier: ConsentTier,
  options: {
    operations?: readonly AlphabetConsentOperation[];
    memoryDomains?: readonly MemoryDomain[];
    respectsPrivacySignals?: boolean;
  } = {}
): AlphabetConsentScope {
  return {
    tier,
    operations: options.operations ?? [],
    memoryDomains: options.memoryDomains ?? [],
    respectsPrivacySignals: options.respectsPrivacySignals ?? true,
  };
}

/**
 * Validate that a consent scope is permitted for the visitor's current
 * tier and active privacy signals. Returns a typed error on the first
 * disallowed operation.
 *
 * Validation never relies on the scope's own `tier` field for security
 * decisions — callers must pass the authoritative tier and signals from
 * the server-side consent manager.
 */
export function validateConsentScope(
  scope: AlphabetConsentScope,
  authoritative: { tier: ConsentTier; privacy: PrivacySignals }
): Result<AlphabetConsentScope, AlphabetProtocolError> {
  const { tier, privacy } = authoritative;

  // If the caller does not respect DNT/GPC, refuse anything beyond
  // read_context.
  if (!scope.respectsPrivacySignals && hasPrivacySignal(privacy)) {
    const onlyContext =
      scope.operations.length === 0 ||
      (scope.operations.length === 1 && scope.operations[0] === 'read_context');
    if (!onlyContext) {
      return err(
        protocolError(
          'CONSENT_INSUFFICIENT',
          'Caller does not respect DNT/GPC; only read_context is permitted',
          { operations: [...scope.operations] }
        )
      );
    }
  }

  for (const op of scope.operations) {
    switch (op) {
      case 'read_context':
        // Always allowed — context exposed via AlphabetToolContext is
        // already PII-free by construction.
        break;
      case 'read_memory':
      case 'write_memory':
        if (!canStoreMemory(tier)) {
          return err(
            protocolError(
              'CONSENT_INSUFFICIENT',
              `Operation "${op}" requires consent tier ANONYMOUS or higher`,
              { current: tier, required: 'ANONYMOUS' }
            )
          );
        }
        break;
      case 'personalize':
        if (!canPersonalize(tier, privacy)) {
          return err(
            protocolError(
              'CONSENT_INSUFFICIENT',
              'Personalization requires CONSENTED tier and no DNT/GPC signal',
              { current: tier }
            )
          );
        }
        break;
      case 'analytics':
        // Cohort size is unknown at this layer; defer to k-anonymity at
        // call time. We only enforce the tier floor here.
        if (!canUseAnalytics(tier, Number.POSITIVE_INFINITY)) {
          return err(
            protocolError(
              'CONSENT_INSUFFICIENT',
              'Analytics requires consent tier ANONYMOUS or higher',
              { current: tier }
            )
          );
        }
        break;
      case 'precise_geo':
        if (!canUsePreciseGeo(tier, privacy)) {
          return err(
            protocolError(
              'CONSENT_INSUFFICIENT',
              'Precise geo requires ENRICHED tier and no DNT/GPC signal',
              { current: tier }
            )
          );
        }
        break;
      default: {
        const exhaustive: never = op;
        return err(
          protocolError('INVALID_PROTOCOL_REQUEST', 'Unknown consent operation', {
            operation: exhaustive,
          })
        );
      }
    }
  }

  return ok(scope);
}

// ─── Memory Permission ───────────────────────────────────────────────────────

/**
 * Domains that are read-only for everyone except admins. Writes to these
 * domains are denied at the protocol layer.
 */
const ADMIN_WRITE_ONLY_DOMAINS: ReadonlySet<MemoryDomain> = new Set<MemoryDomain>([
  'class_notes',
  'tech_pulse',
]);

/**
 * Compute read/write permission for a single memory domain given a
 * consent tier and privacy signals. Pure function — safe to call from
 * any adapter.
 */
export function evaluateMemoryPermission(
  domain: MemoryDomain,
  authoritative: { tier: ConsentTier; privacy: PrivacySignals }
): AlphabetMemoryPermission {
  const { tier, privacy } = authoritative;

  // DNT/GPC forces read-only context with no memory access at all.
  if (hasPrivacySignal(privacy)) {
    return {
      domain,
      canRead: false,
      canWrite: false,
      requiredTier: 'ANONYMOUS',
      reason: 'DNT/GPC active — memory access disabled',
    };
  }

  if (!canStoreMemory(tier)) {
    return {
      domain,
      canRead: false,
      canWrite: false,
      requiredTier: 'ANONYMOUS',
      reason: 'Tier NO_MEMORY does not permit memory access',
    };
  }

  // `general` and `site_specific` read for everyone tier ≥ ANONYMOUS.
  // `visitor` is isolated — readable only by the owning visitor session.
  // `class_notes` and `tech_pulse` are admin-only writes.
  const adminWriteOnly = ADMIN_WRITE_ONLY_DOMAINS.has(domain);
  const requiresEnriched = domain === 'visitor';

  const canRead = requiresEnriched
    ? CONSENT_TIER_LEVEL[tier] >= CONSENT_TIER_LEVEL.CONSENTED
    : true;

  const canWrite = adminWriteOnly
    ? false
    : CONSENT_TIER_LEVEL[tier] >=
      (requiresEnriched ? CONSENT_TIER_LEVEL.CONSENTED : CONSENT_TIER_LEVEL.ANONYMOUS);

  const permission: AlphabetMemoryPermission = {
    domain,
    canRead,
    canWrite,
    requiredTier: requiresEnriched ? 'CONSENTED' : 'ANONYMOUS',
    ...(adminWriteOnly && !canWrite
      ? { reason: 'Domain is admin-write-only' }
      : {}),
  };

  return permission;
}

// ─── Context Sanitization ────────────────────────────────────────────────────

/**
 * Patterns that strongly indicate Personally Identifiable Information.
 * Used as a defensive last line of defense — adapters should not be
 * passing PII into AlphabetToolContext in the first place.
 */
const PII_PATTERNS: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/i,                 // email
  /\+?\d[\d\s().-]{7,}\d/,                     // phone-like
  /\b(?:\d[ -]*?){13,19}\b/,                   // long numeric (card-like)
  /\b\d{3}-\d{2}-\d{4}\b/,                     // SSN-like
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,               // IPv4
];

/**
 * Returns true if the given string is likely to contain PII. The check
 * is intentionally conservative.
 */
export function looksLikePII(value: string): boolean {
  return PII_PATTERNS.some((re) => re.test(value));
}

/**
 * Validate that a tool context contains no PII-shaped strings. Used by
 * adapters before exposing context to external agents (MCP, A2A).
 */
export function ensureNoPIIInContext(
  context: AlphabetToolContext
): Result<AlphabetToolContext, AlphabetProtocolError> {
  // Only string fields are checked; ConsentTier / boolean / layer are
  // fixed enums and cannot contain PII.
  const stringFields: ReadonlyArray<readonly [keyof AlphabetToolContext, string | undefined]> = [
    ['visitorId', context.visitorId],
    ['sessionId', context.sessionId],
    ['locale', context.locale],
    ['country', context.country],
  ];

  for (const [field, value] of stringFields) {
    if (typeof value === 'string' && looksLikePII(value)) {
      return err(
        protocolError('PII_DETECTED', `Field "${String(field)}" looks like PII`, {
          field: String(field),
        })
      );
    }
  }
  return ok(context);
}
