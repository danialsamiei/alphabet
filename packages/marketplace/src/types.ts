/**
 * @module @alphabet/marketplace/types
 * @description
 * Public types for the Alphabet Ecosystem & Marketplace.
 *
 * This module defines the manifest shapes that describe a publishable
 * **adaptive component** or **protocol adapter** in the Alphabet
 * Marketplace, along with the trust-score and certification primitives.
 *
 * The types are deliberately serialisable (no functions, no classes) so
 * that any registry — in-memory, REST, or static JSON file — can store
 * and exchange them as plain JSON. Runtime validation lives in
 * `./manifest.js`.
 *
 * Privacy posture is part of the manifest because the marketplace is
 * fundamentally about **respect**: a consumer must be able to filter
 * entries that demand a higher consent tier than they can grant.
 */

/** Marketplace entry kinds. */
export type EntryKind = 'component' | 'protocol-adapter';

/**
 * Minimum consent tier the entry needs to function.
 *
 * Mirrors `@alphabet/security` / `@alphabet/core` consent ladder:
 *  - `0` `NO_MEMORY`   — no persistence at all (Tier 0 default).
 *  - `1` `ANONYMOUS`   — sessionStorage only.
 *  - `2` `CONSENTED`   — localStorage + behavioural personalisation.
 *  - `3` `ENRICHED`    — vector DB / semantic interests.
 */
export type RequiredConsentTier = 0 | 1 | 2 | 3;

/** Adaptive UI layers an entry supports (1 = R3F → 5 = text-only). */
export type SupportedLayer = 1 | 2 | 3 | 4 | 5;

/**
 * Privacy posture self-declared by the entry author and validated by
 * the registry at publish time. These are the only fields that affect
 * the public Trust Score.
 */
export interface PrivacyPosture {
  /** Minimum consent tier required for the entry to function at all. */
  readonly requiredConsentTier: RequiredConsentTier;
  /** `true` iff DNT/GPC headers force the entry to a no-op fallback. */
  readonly respectsDoNotTrack: boolean;
  /** `true` iff no PII is collected even with consent granted. */
  readonly collectsNoPii: boolean;
  /** `true` iff all data stays on the client device. */
  readonly localOnly: boolean;
  /** Memory domains the entry reads (must already exist in the host). */
  readonly memoryDomainsRead: readonly string[];
  /** Memory domains the entry writes. Empty for read-only entries. */
  readonly memoryDomainsWritten: readonly string[];
}

/** SemVer string. Validated structurally only. */
export type SemVer = string;

/**
 * A single immutable entry author / maintainer.
 * `id` is the marketplace handle; `did` is an optional W3C
 * Decentralised Identifier for cryptographically signed entries.
 */
export interface Maintainer {
  readonly id: string;
  readonly displayName: string;
  readonly did?: string;
}

/** Common manifest fields shared by components and adapters. */
export interface ManifestBase {
  /** Globally unique slug, e.g. `@alphabet/official:consent-banner`. */
  readonly id: string;
  readonly kind: EntryKind;
  readonly version: SemVer;
  readonly title: string;
  readonly description: string;
  readonly maintainers: readonly Maintainer[];
  readonly license: string;
  /**
   * `true` when the entry is published by the Alphabet core team. The
   * registry refuses to set this flag on consumer-published manifests.
   */
  readonly official: boolean;
  readonly homepage?: string;
  readonly repository?: string;
  readonly tags: readonly string[];
  readonly privacy: PrivacyPosture;
}

/** Manifest for an adaptive UI component. */
export interface ComponentManifest extends ManifestBase {
  readonly kind: 'component';
  /**
   * Layers the component renders correctly on. Order is irrelevant.
   * An empty array is rejected by the validator.
   */
  readonly supportedLayers: readonly SupportedLayer[];
  /**
   * Free-form capability tags consumers filter by. e.g.
   * `['rtl', 'a11y-AA', 'reduced-motion-safe']`.
   */
  readonly capabilities: readonly string[];
  /** Module entry point (npm specifier, URL, or workspace path). */
  readonly entry: string;
  /** Approximate gzipped bundle size in bytes (declared by author). */
  readonly bundleBytesGzip?: number;
}

/** Manifest for an Alphabet protocol adapter (MCP / A2A / QR / REST). */
export interface ProtocolAdapterManifest extends ManifestBase {
  readonly kind: 'protocol-adapter';
  /** Wire protocol the adapter speaks. */
  readonly protocol: 'mcp' | 'a2a' | 'qr-handoff' | 'rest' | 'custom';
  /**
   * Symbolic capabilities the adapter exposes — e.g. resource discovery,
   * tool calling, streaming. Used by the registry for capability search.
   */
  readonly capabilities: readonly string[];
  /** Module entry point (npm specifier, URL, or workspace path). */
  readonly entry: string;
}

/** Discriminated union of all manifest kinds. */
export type MarketplaceManifest = ComponentManifest | ProtocolAdapterManifest;

// ─── Trust score & badge ─────────────────────────────────────────────────────

/** Letter grade derived from a {@link TrustScore.score}. */
export type TrustGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

/**
 * Telemetry signals supplied **at runtime** to compute a live trust
 * badge for a deployment. Every field is optional — the scorer must
 * degrade gracefully when a host has not opted in to telemetry.
 *
 * The fields are deliberately coarse and aggregate: per-visitor data
 * never enters the badge.
 */
export interface RuntimeTelemetry {
  /** Sessions in the last 24h that ran with no memory persistence. */
  readonly noMemorySessions24h?: number;
  /** Sessions in the last 24h with explicit (Tier ≥ 2) consent. */
  readonly explicitConsentSessions24h?: number;
  /** Sessions in the last 24h auto-downgraded by DNT/GPC. */
  readonly dntDowngrades24h?: number;
  /** Number of consent-revocation events honoured in the last 24h. */
  readonly revocationsHonoured24h?: number;
  /** Number of failed memory-integrity checks in the last 24h. */
  readonly memoryIntegrityFailures24h?: number;
}

/** Inputs to the deterministic trust scorer. */
export interface TrustScoreInput {
  readonly manifest: MarketplaceManifest;
  /** Optional runtime signals — when omitted, score uses manifest only. */
  readonly telemetry?: RuntimeTelemetry;
}

/** Itemised reason a trust score landed where it did. */
export interface TrustReason {
  readonly code: string;
  readonly message: string;
  readonly delta: number;
}

/** Output of {@link computeTrustScore}. */
export interface TrustScore {
  /** Score in the closed interval `[0, 100]`. */
  readonly score: number;
  readonly grade: TrustGrade;
  readonly reasons: readonly TrustReason[];
  /** ISO-8601 instant the score was computed. */
  readonly computedAt: string;
}

/** Embeddable badge data — payload for an `<img>` or JSON consumer. */
export interface TrustBadge {
  readonly entryId: string;
  readonly score: TrustScore;
  /** Self-contained SVG. Safe to inline. */
  readonly svg: string;
  /** Stable JSON form for shields.io-style badges. */
  readonly json: {
    readonly schemaVersion: 1;
    readonly label: 'alphabet trust';
    readonly message: string;
    readonly color: string;
  };
}

// ─── Certification ───────────────────────────────────────────────────────────

/**
 * Levels of the *Alphabet Certified Builder* programme.
 * Each level extends the previous one — Silver implies Bronze, Gold
 * implies Silver.
 */
export type CertificationLevel = 'bronze' | 'silver' | 'gold';

/** Signed assertion that a maintainer reached a level for an entry. */
export interface CertificationRecord {
  readonly maintainerId: string;
  readonly entryId: string;
  readonly level: CertificationLevel;
  readonly issuedAt: string;
  readonly criteriaMet: readonly string[];
}

/** Result of evaluating an entry against the certification criteria. */
export interface CertificationEvaluation {
  readonly level: CertificationLevel | null;
  readonly criteriaMet: readonly string[];
  readonly criteriaMissing: readonly string[];
}
