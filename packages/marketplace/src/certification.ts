/**
 * @module @alphabet/marketplace/certification
 * @description
 * The **Alphabet Certified Builder** programme — programmatic
 * verification of the criteria a maintainer must meet for an entry
 * to qualify for Bronze, Silver, or Gold certification.
 *
 * Certification is *evidence-based*: every check is a function of the
 * manifest, the trust score, and (optionally) build artefacts the
 * maintainer attaches at publish time. There is no closed-room review
 * step in the criteria; humans may still revoke a certification, but
 * the rules in this file constitute the entry-level bar that any
 * automated CI gate can reproduce.
 *
 * The criteria deliberately compose:
 *  - Bronze   = privacy hygiene + maintainable manifest.
 *  - Silver   = Bronze + trust score ≥ B + supports degraded layers.
 *  - Gold     = Silver + trust score ≥ A + signed maintainer (DID)
 *               + zero PII collection + DNT/GPC respected.
 */

import type {
  CertificationEvaluation,
  CertificationLevel,
  ComponentManifest,
  MarketplaceManifest,
  TrustScore,
} from './types.js';
import { computeTrustScore } from './trust-score.js';

/** Stable codes, suitable for surface-level UIs and audit logs. */
export const CERTIFICATION_CRITERIA = {
  RESPECTS_DNT: 'respects-dnt',
  TIER_AT_MOST_2: 'tier-at-most-2',
  AT_LEAST_ONE_MAINTAINER: 'at-least-one-maintainer',
  HAS_LICENSE: 'has-license',
  TRUST_GRADE_B_OR_BETTER: 'trust-grade-b-or-better',
  SUPPORTS_DEGRADED_LAYERS: 'supports-degraded-layers',
  TRUST_GRADE_A_OR_BETTER: 'trust-grade-a-or-better',
  COLLECTS_NO_PII: 'collects-no-pii',
  SIGNED_MAINTAINER_DID: 'signed-maintainer-did',
} as const;

type CriterionCode =
  (typeof CERTIFICATION_CRITERIA)[keyof typeof CERTIFICATION_CRITERIA];

const BRONZE_CRITERIA: readonly CriterionCode[] = [
  CERTIFICATION_CRITERIA.RESPECTS_DNT,
  CERTIFICATION_CRITERIA.TIER_AT_MOST_2,
  CERTIFICATION_CRITERIA.AT_LEAST_ONE_MAINTAINER,
  CERTIFICATION_CRITERIA.HAS_LICENSE,
];

const SILVER_ADDITIONAL: readonly CriterionCode[] = [
  CERTIFICATION_CRITERIA.TRUST_GRADE_B_OR_BETTER,
  CERTIFICATION_CRITERIA.SUPPORTS_DEGRADED_LAYERS,
];

const GOLD_ADDITIONAL: readonly CriterionCode[] = [
  CERTIFICATION_CRITERIA.TRUST_GRADE_A_OR_BETTER,
  CERTIFICATION_CRITERIA.COLLECTS_NO_PII,
  CERTIFICATION_CRITERIA.SIGNED_MAINTAINER_DID,
];

function isComponent(m: MarketplaceManifest): m is ComponentManifest {
  return m.kind === 'component';
}

/** Evaluate every criterion deterministically. */
function checkCriterion(
  code: CriterionCode,
  manifest: MarketplaceManifest,
  score: TrustScore,
): boolean {
  switch (code) {
    case CERTIFICATION_CRITERIA.RESPECTS_DNT:
      return manifest.privacy.respectsDoNotTrack;
    case CERTIFICATION_CRITERIA.TIER_AT_MOST_2:
      return manifest.privacy.requiredConsentTier <= 2;
    case CERTIFICATION_CRITERIA.AT_LEAST_ONE_MAINTAINER:
      return manifest.maintainers.length >= 1;
    case CERTIFICATION_CRITERIA.HAS_LICENSE:
      return manifest.license.trim().length > 0;
    case CERTIFICATION_CRITERIA.TRUST_GRADE_B_OR_BETTER:
      return ['A+', 'A', 'B'].includes(score.grade);
    case CERTIFICATION_CRITERIA.SUPPORTS_DEGRADED_LAYERS:
      // Only meaningful for components; adapters auto-pass since the
      // criterion does not apply to wire protocols.
      if (!isComponent(manifest)) return true;
      return (
        manifest.supportedLayers.includes(4) ||
        manifest.supportedLayers.includes(5)
      );
    case CERTIFICATION_CRITERIA.TRUST_GRADE_A_OR_BETTER:
      return ['A+', 'A'].includes(score.grade);
    case CERTIFICATION_CRITERIA.COLLECTS_NO_PII:
      return manifest.privacy.collectsNoPii;
    case CERTIFICATION_CRITERIA.SIGNED_MAINTAINER_DID:
      // Minimal W3C DID format: `did:<method>:<method-specific-id>`.
      return manifest.maintainers.some(
        (m) => typeof m.did === 'string' && /^did:[a-z0-9]+:.+/.test(m.did),
      );
  }
}

/**
 * Evaluate an entry against the certification criteria. Returns the
 * highest level reached *and* every criterion's status, so a UI can
 * show maintainers exactly what to fix to advance.
 */
export function evaluateCertification(
  manifest: MarketplaceManifest,
  scoreOverride?: TrustScore,
): CertificationEvaluation {
  const score =
    scoreOverride ?? computeTrustScore({ manifest });
  const allCriteria: readonly CriterionCode[] = [
    ...BRONZE_CRITERIA,
    ...SILVER_ADDITIONAL,
    ...GOLD_ADDITIONAL,
  ];
  const met: CriterionCode[] = [];
  const missing: CriterionCode[] = [];
  for (const code of allCriteria) {
    if (checkCriterion(code, manifest, score)) {
      met.push(code);
    } else {
      missing.push(code);
    }
  }

  const hasAll = (xs: readonly CriterionCode[]): boolean =>
    xs.every((c) => met.includes(c));

  let level: CertificationLevel | null = null;
  if (hasAll(BRONZE_CRITERIA)) level = 'bronze';
  if (level && hasAll(SILVER_ADDITIONAL)) level = 'silver';
  if (level === 'silver' && hasAll(GOLD_ADDITIONAL)) level = 'gold';

  return { level, criteriaMet: met, criteriaMissing: missing };
}
