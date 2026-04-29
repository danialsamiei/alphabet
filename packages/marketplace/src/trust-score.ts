/**
 * @module @alphabet/marketplace/trust-score
 * @description
 * The **Public Trust Score API** — a deterministic scoring function
 * over a manifest's privacy posture and (optionally) live runtime
 * telemetry. Output is suitable for both human-facing badges and
 * machine-readable consumption by other Alphabet sites.
 *
 * Design goals:
 *  - **Deterministic.** Same input → same score. No randomness, no
 *    network calls, no time-dependent terms beyond `computedAt`.
 *  - **Privacy-respecting by construction.** Every signal in the
 *    formula is itself a privacy property; raising the score requires
 *    behaving better, not measuring users more.
 *  - **Explainable.** The score is the sum of signed contributions,
 *    each carrying a `code` and a human message, so a UI can show
 *    *why* a score is what it is.
 *
 * The formula is documented in `docs/MARKETPLACE.md` and is a public
 * contract — registry consumers may rely on the codes returned in
 * `reasons[]` to render their own copy.
 */

import type {
  RuntimeTelemetry,
  TrustBadge,
  TrustGrade,
  TrustReason,
  TrustScore,
  TrustScoreInput,
} from './types.js';

const BASE_SCORE = 50;
const MAX_SCORE = 100;
const MIN_SCORE = 0;

function clamp(n: number): number {
  if (n > MAX_SCORE) return MAX_SCORE;
  if (n < MIN_SCORE) return MIN_SCORE;
  return Math.round(n);
}

function gradeFor(score: number): TrustGrade {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/**
 * Compute the public trust score for a manifest, optionally enriched
 * with anonymous runtime telemetry.
 *
 * The function is pure: callers may invoke it during a render without
 * needing memoisation beyond their own discretion.
 */
export function computeTrustScore(input: TrustScoreInput): TrustScore {
  const reasons: TrustReason[] = [];
  let score = BASE_SCORE;

  // ── Manifest-derived contributions ──────────────────────────────────
  const p = input.manifest.privacy;

  if (p.requiredConsentTier === 0) {
    reasons.push({
      code: 'TIER_0_BY_DEFAULT',
      message: 'works with no memory persistence (Tier 0)',
      delta: +20,
    });
    score += 20;
  } else if (p.requiredConsentTier === 1) {
    reasons.push({
      code: 'ANONYMOUS_TIER',
      message: 'requires only anonymous session memory (Tier 1)',
      delta: +10,
    });
    score += 10;
  } else if (p.requiredConsentTier === 3) {
    reasons.push({
      code: 'ENRICHED_REQUIRED',
      message: 'requires enriched memory (Tier 3)',
      delta: -5,
    });
    score -= 5;
  }

  if (p.respectsDoNotTrack) {
    reasons.push({
      code: 'RESPECTS_DNT',
      message: 'honours DNT / GPC signals',
      delta: +10,
    });
    score += 10;
  } else {
    reasons.push({
      code: 'IGNORES_DNT',
      message: 'does not honour DNT / GPC',
      delta: -25,
    });
    score -= 25;
  }
  if (p.collectsNoPii) {
    reasons.push({
      code: 'NO_PII',
      message: 'collects no personally identifying information',
      delta: +10,
    });
    score += 10;
  }
  if (p.localOnly) {
    reasons.push({
      code: 'LOCAL_ONLY',
      message: 'all data stays on the client device',
      delta: +5,
    });
    score += 5;
  }
  if (input.manifest.official) {
    reasons.push({
      code: 'OFFICIAL_ENTRY',
      message: 'maintained by the Alphabet core team',
      delta: +5,
    });
    score += 5;
  }

  // ── Runtime telemetry contributions ────────────────────────────────
  if (input.telemetry) {
    const t = input.telemetry;
    const totalSessions =
      (t.noMemorySessions24h ?? 0) +
      (t.explicitConsentSessions24h ?? 0) +
      (t.dntDowngrades24h ?? 0);

    if (totalSessions > 0 && t.dntDowngrades24h !== undefined) {
      reasons.push({
        code: 'DNT_DOWNGRADES_HONOURED',
        message: 'observed DNT downgrades were honoured',
        delta: +5,
      });
      score += 5;
    }
    if ((t.revocationsHonoured24h ?? 0) > 0) {
      reasons.push({
        code: 'REVOCATIONS_HONOURED',
        message: 'consent revocations honoured in the last 24h',
        delta: +5,
      });
      score += 5;
    }
    if ((t.memoryIntegrityFailures24h ?? 0) > 0) {
      reasons.push({
        code: 'INTEGRITY_FAILURES',
        message: 'memory integrity failures were detected',
        delta: -10,
      });
      score -= 10;
    }
  }

  const finalScore = clamp(score);
  return {
    score: finalScore,
    grade: gradeFor(finalScore),
    reasons,
    computedAt: new Date().toISOString(),
  };
}

// ─── Trust badge ─────────────────────────────────────────────────────────────

const COLOR_BY_GRADE: Readonly<Record<TrustGrade, string>> = {
  'A+': '#0e7c3a',
  A: '#1f9d55',
  B: '#a8a300',
  C: '#c97a00',
  D: '#a3160b',
};

/**
 * Render an embeddable trust badge for an entry. The SVG is
 * self-contained and safe to inline; it includes no external font
 * references and no script. The JSON form mirrors the shields.io
 * "endpoint" badge schema for easy reuse.
 *
 * @param entryId — the manifest id the badge is for.
 * @param score   — the precomputed score, typically from
 *                  {@link computeTrustScore}.
 */
export function renderTrustBadge(entryId: string, score: TrustScore): TrustBadge {
  const message = `${score.grade} (${score.score})`;
  const color = COLOR_BY_GRADE[score.grade];
  const labelText = 'alphabet trust';

  // SVG is intentionally hand-rolled and minimal: no external font, no
  // dependencies, fixed metrics so width is deterministic.
  const labelW = 110;
  const valueW = 70;
  const totalW = labelW + valueW;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${labelText}: ${message}">` +
    `<title>${labelText}: ${message}</title>` +
    `<rect width="${labelW}" height="20" fill="#555"/>` +
    `<rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>` +
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">` +
    `<text x="${labelW / 2}" y="14">${labelText}</text>` +
    `<text x="${labelW + valueW / 2}" y="14">${message}</text>` +
    `</g></svg>`;

  return {
    entryId,
    score,
    svg,
    json: {
      schemaVersion: 1,
      label: 'alphabet trust',
      message,
      color,
    },
  };
}

/**
 * Convenience: validate, compute, and render in one call. Useful for
 * the Public Trust Score API edge function — see
 * `docs/MARKETPLACE.md`.
 */
export function buildTrustBadge(
  input: TrustScoreInput,
): TrustBadge {
  const score = computeTrustScore(input);
  return renderTrustBadge(input.manifest.id, score);
}

/**
 * Telemetry helper — strips any field that is not part of
 * {@link RuntimeTelemetry} so that callers cannot accidentally feed
 * PII into the scorer.
 */
export function sanitizeTelemetry(input: unknown): RuntimeTelemetry {
  const out: { -readonly [K in keyof RuntimeTelemetry]?: number } = {};
  if (typeof input !== 'object' || input === null) return out;
  const allow: ReadonlyArray<keyof RuntimeTelemetry> = [
    'noMemorySessions24h',
    'explicitConsentSessions24h',
    'dntDowngrades24h',
    'revocationsHonoured24h',
    'memoryIntegrityFailures24h',
  ];
  const obj = input as Record<string, unknown>;
  for (const key of allow) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      out[key] = Math.floor(v);
    }
  }
  return out;
}
