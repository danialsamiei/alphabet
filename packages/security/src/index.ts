/**
 * @module @awaf/security
 * @description
 * پکیج Security — guardrailهای عملی برای SDK web آگاه از AI.
 * Security package — practical, lightweight guardrails for an
 * AI-aware web SDK.
 *
 * **Scope.** This package is a *defence-in-depth supplement*, not a
 * full security solution. It ships with conservative defaults and
 * documents its limitations explicitly. See `docs/SECURITY_MODEL.md`
 * for OWASP LLM mapping, threat coverage, and recommended deployment
 * practices.
 *
 * **Modules.**
 *  - `consent`           — `ConsentTierManager` (state machine + DNT/GPC).
 *  - `pii`               — `redactPII`, `redactPIIDeep`, `detectPII`.
 *  - `prompt-injection`  — `detectPromptRisk`, heuristic injection scoring.
 *  - `output-validation` — `validateUrl`, `sanitizeHtml`, `markTextAsSafe`.
 *  - `memory-integrity`  — `MemoryIntegrityGuard` (tier + ACL enforcement).
 *  - `audit`             — `AWAFAuditLogger`, `InMemoryAuditSink`.
 *  - `policies`          — privacy policy version, ACL defaults,
 *                          prompt-injection patterns.
 */

export type { AWAFError } from '@awaf/core';

// ─── Consent ─────────────────────────────────────────────────────────────────
export { ConsentTierManager } from './consent/consent-tier-manager.js';
export type {
  ConsentManagerState,
  ConsentTierExplanation,
  ConsentSnapshot,
  ConsentTierManagerOptions,
} from './consent/consent-tier-manager.js';

// ─── Consent storage adapters ────────────────────────────────────────────────
export {
  InMemoryConsentStorage,
  WebStorageConsentStorage,
  DEFAULT_CONSENT_STORAGE_KEY,
} from './consent/storage/index.js';
export type {
  SyncConsentStorageAdapter,
  WebStorageConsentStorageOptions,
} from './consent/storage/index.js';

// ─── PII redaction ───────────────────────────────────────────────────────────
export { detectPII, redactPII, redactPIIDeep } from './pii/redactor.js';
export type {
  PIIKind,
  PIIFinding,
  RedactionResult,
  RedactionStrictness,
  RedactPIIOptions,
} from './pii/redactor.js';

// ─── Prompt injection heuristics ─────────────────────────────────────────────
export { detectPromptRisk, isHighRisk } from './prompt-injection/detector.js';
export type {
  PromptRiskAssessment,
  PromptRiskAction,
  PromptRiskLevel,
  PromptRiskMatch,
  DetectPromptRiskOptions,
} from './prompt-injection/detector.js';

// ─── Output validation ───────────────────────────────────────────────────────
export {
  validateUrl,
  sanitizeHtml,
  markTextAsSafe,
  isSafeRender,
  DEFAULT_ALLOWED_PROTOCOLS,
} from './output-validation/output-guard.js';
export type {
  UrlValidationResult,
  UrlValidationError,
  ValidateUrlOptions,
  SanitizeHtmlOptions,
  SanitizeHtmlResult,
  SafeRender,
} from './output-validation/output-guard.js';

// ─── Memory integrity ────────────────────────────────────────────────────────
export { MemoryIntegrityGuard } from './memory-integrity/memory-integrity-guard.js';
export type {
  MemoryActorRole,
  MemoryWriteContext,
  MemoryReadContext,
  MemoryDecision,
  MemoryIntegrityGuardOptions,
} from './memory-integrity/memory-integrity-guard.js';

// ─── Audit logging ───────────────────────────────────────────────────────────
export { AWAFAuditLogger, InMemoryAuditSink } from './audit/audit-logger.js';
export type {
  AuditEvent,
  AuditEventBase,
  AuditEventCategory,
  AuditEventSeverity,
  AuditSink,
  AuditLoggerOptions,
} from './audit/audit-logger.js';

// ─── Policies ────────────────────────────────────────────────────────────────
export {
  DEFAULT_POLICY_VERSION,
  DEFAULT_DOMAIN_READ_ACL,
  ADMIN_ONLY_WRITE_DOMAINS,
  DEFAULT_PROMPT_INJECTION_PATTERNS,
} from './policies/index.js';
export type { PromptInjectionPattern } from './policies/index.js';
