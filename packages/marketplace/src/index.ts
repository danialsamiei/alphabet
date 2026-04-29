/**
 * @module @alphabet/marketplace
 * @description
 * The Alphabet Ecosystem & Marketplace package.
 *
 * Four innovations live here:
 *  1. **Component & Protocol Marketplace** — `Registry`, manifest
 *     schema, and `InMemoryRegistry` for publishing and discovering
 *     adaptive components and protocol adapters.
 *  2. **Public Trust Score API** — `computeTrustScore` and
 *     `renderTrustBadge` produce a deterministic, privacy-respecting
 *     badge any Alphabet site can embed.
 *  3. **W3C "Respectful Context Handshake"** — the spec proposal lives
 *     in `docs/W3C_RESPECTFUL_CONTEXT_HANDSHAKE.md`; the manifest
 *     schema in this package is the reference implementation of the
 *     proposal's *capability declaration* primitive.
 *  4. **Alphabet Certified Builder** — `evaluateCertification` checks
 *     a manifest against Bronze / Silver / Gold criteria.
 *
 * The package is **additive**: it does not change any other package's
 * public surface. It depends only on `@alphabet/core` types and the
 * `@alphabet/core/contracts/runtime` validators.
 */

export * from './types.js';
export { validateManifest, isMarketplaceManifest } from './manifest.js';
export type { Registry, RegistryQuery } from './registry.js';
export { InMemoryRegistry } from './registry.js';
export {
  computeTrustScore,
  renderTrustBadge,
  buildTrustBadge,
  sanitizeTelemetry,
} from './trust-score.js';
export {
  evaluateCertification,
  CERTIFICATION_CRITERIA,
} from './certification.js';
