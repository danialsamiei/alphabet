/**
 * @module memory-integrity/memory-integrity-guard
 * @description
 * MemoryIntegrityGuard — اعتبارسنجی نوشتن/خواندن حافظه با توجه به consent
 * tier، domain isolation، و ACL کراس‌دامنه.
 *
 * Validates memory operations against three policies:
 *  1. **Consent tier.** Tier 0 (`NO_MEMORY`) blocks every write. Higher
 *     tiers permit progressively more domains and purposes.
 *  2. **Actor role.** Domains in `ADMIN_ONLY_WRITE_DOMAINS` may only be
 *     written by an actor whose role is `'admin'`.
 *  3. **Cross-domain ACL.** A read from domain `R` into domain `D` is
 *     allowed only if `R` is in the read ACL for `D`. The default ACL
 *     keeps `visitor` strictly isolated.
 *
 * **Limitations.** This guard is a policy enforcement point — it does
 * not encrypt memory, hash visitor ids, or persist anything. It is
 * meant to be wired into the storage layer at the point where reads
 * and writes cross trust boundaries.
 */

import {
  CONSENT_TIER_LEVEL,
  type ConsentTier,
  type MemoryDomain,
  type Result,
  type AlphabetError,
  ok,
  err,
} from '@alphabet/core';
import {
  ADMIN_ONLY_WRITE_DOMAINS,
  DEFAULT_DOMAIN_READ_ACL,
} from '../policies/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** نقش انجام‌دهنده عملیات حافظه. */
export type MemoryActorRole = 'visitor' | 'site' | 'admin';

/** بافتار یک نوشتن حافظه. */
export interface MemoryWriteContext {
  readonly domain: MemoryDomain;
  readonly consentTier: ConsentTier;
  readonly actorRole: MemoryActorRole;
}

/**
 * بافتار یک خواندن حافظه.
 *
 * `ownerDomain` is the domain that *owns* the data being read.
 * `readerDomain` is the domain *requesting* the data. A read is allowed
 * only when `readerDomain ∈ readAcl[ownerDomain]`.
 */
export interface MemoryReadContext {
  /** Domain that owns the data being read. */
  readonly ownerDomain: MemoryDomain;
  /** Domain requesting the data. */
  readonly readerDomain: MemoryDomain;
  readonly consentTier: ConsentTier;
}

/** Decision خروجی guard. */
export type MemoryDecision = Result<{ readonly allowed: true }, AlphabetError>;

/** گزینه‌های guard. */
export interface MemoryIntegrityGuardOptions {
  /** ACL سفارشی — پیش‌فرض `DEFAULT_DOMAIN_READ_ACL`. */
  readonly readAcl?: Readonly<Record<MemoryDomain, readonly MemoryDomain[]>>;
  /** دامنه‌های فقط-admin — پیش‌فرض `ADMIN_ONLY_WRITE_DOMAINS`. */
  readonly adminOnlyWriteDomains?: readonly MemoryDomain[];
  /**
   * نگاشت دامنه به حداقل tier لازم برای write. پیش‌فرض زیر استفاده
   * می‌شود — همه دامنه‌ها به جز `general` به ANONYMOUS یا بالاتر نیاز
   * دارند، و `tech_pulse` هم همینطور.
   */
  readonly minTierForWrite?: Readonly<Record<MemoryDomain, ConsentTier>>;
}

const DEFAULT_MIN_TIER_FOR_WRITE: Readonly<Record<MemoryDomain, ConsentTier>> = {
  general: 'ANONYMOUS',
  site_specific: 'ANONYMOUS',
  visitor: 'CONSENTED',
  class_notes: 'ANONYMOUS',
  ideas: 'CONSENTED',
  social: 'CONSENTED',
  tech_pulse: 'ANONYMOUS',
};

// ─── Guard class ─────────────────────────────────────────────────────────────

/**
 * Pure policy enforcer for memory operations. Stateless — safe to share
 * across requests.
 *
 * @example
 * const guard = new MemoryIntegrityGuard();
 * guard.canWrite({ domain: 'visitor', consentTier: 'CONSENTED', actorRole: 'visitor' });
 * // → { success: true, data: { allowed: true } }
 */
export class MemoryIntegrityGuard {
  private readonly readAcl: Readonly<Record<MemoryDomain, readonly MemoryDomain[]>>;
  private readonly adminOnlyWriteDomains: readonly MemoryDomain[];
  private readonly minTierForWrite: Readonly<Record<MemoryDomain, ConsentTier>>;

  constructor(options: MemoryIntegrityGuardOptions = {}) {
    this.readAcl = options.readAcl ?? DEFAULT_DOMAIN_READ_ACL;
    this.adminOnlyWriteDomains = options.adminOnlyWriteDomains ?? ADMIN_ONLY_WRITE_DOMAINS;
    this.minTierForWrite = options.minTierForWrite ?? DEFAULT_MIN_TIER_FOR_WRITE;
  }

  /**
   * بررسی اینکه آیا یک نوشتن مجاز است.
   * Validate a write operation against tier and admin policy.
   */
  canWrite(ctx: MemoryWriteContext): MemoryDecision {
    if (ctx.consentTier === 'NO_MEMORY') {
      return err({
        code: 'MEMORY_WRITE_BLOCKED_NO_CONSENT',
        message: 'Memory writes are not allowed at consent tier NO_MEMORY',
        details: { domain: ctx.domain, consentTier: ctx.consentTier },
      });
    }

    // `minTier` may be `undefined` if a caller passed a partial custom
    // `minTierForWrite` mapping. Treat that as "fail closed": deny the write.
    const minTier = this.minTierForWrite[ctx.domain];
    if (minTier === undefined) {
      return err({
        code: 'MEMORY_WRITE_BLOCKED_NO_POLICY',
        message: `No write policy configured for domain ${ctx.domain}`,
        details: { domain: ctx.domain },
      });
    }
    if (CONSENT_TIER_LEVEL[ctx.consentTier] < CONSENT_TIER_LEVEL[minTier]) {
      return err({
        code: 'MEMORY_WRITE_BLOCKED_TIER',
        message: `Domain ${ctx.domain} requires tier ${minTier}; got ${ctx.consentTier}`,
        details: { domain: ctx.domain, requiredTier: minTier, currentTier: ctx.consentTier },
      });
    }

    if (this.adminOnlyWriteDomains.includes(ctx.domain) && ctx.actorRole !== 'admin') {
      return err({
        code: 'MEMORY_WRITE_BLOCKED_ROLE',
        message: `Domain ${ctx.domain} is admin-only; actor role ${ctx.actorRole}`,
        details: { domain: ctx.domain, actorRole: ctx.actorRole },
      });
    }

    return ok({ allowed: true });
  }

  /**
   * بررسی اینکه آیا یک خواندن کراس‌دامنه مجاز است.
   * Validate a cross-domain read.
   *
   * Reads from a domain to itself are always allowed (subject to tier).
   * Reads where the reader domain is not in the owner domain's ACL are
   * denied.
   */
  canRead(ctx: MemoryReadContext): MemoryDecision {
    if (ctx.consentTier === 'NO_MEMORY' && ctx.ownerDomain !== 'general') {
      return err({
        code: 'MEMORY_READ_BLOCKED_NO_CONSENT',
        message: 'Memory reads beyond `general` are not allowed at NO_MEMORY tier',
        details: {
          ownerDomain: ctx.ownerDomain,
          readerDomain: ctx.readerDomain,
          consentTier: ctx.consentTier,
        },
      });
    }

    if (ctx.ownerDomain === ctx.readerDomain) {
      return ok({ allowed: true });
    }

    // `allowedReaders` may be `undefined` if a caller passed a partial
    // custom ACL. Fail closed: deny the read.
    const allowedReaders = this.readAcl[ctx.ownerDomain];
    if (allowedReaders === undefined || !allowedReaders.includes(ctx.readerDomain)) {
      return err({
        code: 'MEMORY_READ_BLOCKED_ACL',
        message: `Reader domain ${ctx.readerDomain} is not allowed to read ${ctx.ownerDomain}`,
        details: {
          ownerDomain: ctx.ownerDomain,
          readerDomain: ctx.readerDomain,
        },
      });
    }

    return ok({ allowed: true });
  }
}
