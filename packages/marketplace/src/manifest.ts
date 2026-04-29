/**
 * @module @alphabet/marketplace/manifest
 * @description
 * Runtime validation for marketplace manifests.
 *
 * Manifests submitted to the registry come from untrusted authors, so
 * we validate every field — even those `TypeScript` already covers — at
 * the boundary using the dependency-free combinators from
 * `@alphabet/core/contracts/runtime`. Validation never throws; it
 * returns a `Result<T, ValidationError>` whose issues carry stable
 * paths suitable for surface-level error rendering.
 *
 * Authors cannot self-declare `official: true`. The registry strips
 * that bit unless an explicit official-publish hook approves it; this
 * module enforces the same invariant by rejecting `official: true`
 * unless the entry id starts with the reserved `@alphabet/official:`
 * prefix.
 */

import type { Result } from '@alphabet/core';
import { err, ok } from '@alphabet/core';
import {
  v,
  type ValidationError,
  type ValidationIssue,
} from '@alphabet/core/contracts/runtime';

import type { MarketplaceManifest } from './types.js';

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ID_RE = /^(?:@?[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)?$/;
const OFFICIAL_PREFIX = '@alphabet/official:';

const maintainerSchema = v.object({
  id: v.string(),
  displayName: v.string(),
  did: v.optional(v.string()),
});

const tierSchema = v.union([
  v.literal(0),
  v.literal(1),
  v.literal(2),
  v.literal(3),
]);

const privacySchema = v.object({
  requiredConsentTier: tierSchema,
  respectsDoNotTrack: v.boolean(),
  collectsNoPii: v.boolean(),
  localOnly: v.boolean(),
  memoryDomainsRead: v.array(v.string()),
  memoryDomainsWritten: v.array(v.string()),
});

const layerSchema = v.union([
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
]);

const baseShape = {
  id: v.string(),
  version: v.string(),
  title: v.string(),
  description: v.string(),
  maintainers: v.array(maintainerSchema),
  license: v.string(),
  official: v.boolean(),
  homepage: v.optional(v.string()),
  repository: v.optional(v.string()),
  tags: v.array(v.string()),
  privacy: privacySchema,
} as const;

const componentSchema = v.object({
  ...baseShape,
  kind: v.literal('component'),
  supportedLayers: v.array(layerSchema),
  capabilities: v.array(v.string()),
  entry: v.string(),
  bundleBytesGzip: v.optional(v.number()),
});

const adapterSchema = v.object({
  ...baseShape,
  kind: v.literal('protocol-adapter'),
  protocol: v.enum(['mcp', 'a2a', 'qr-handoff', 'rest', 'custom'] as const),
  capabilities: v.array(v.string()),
  entry: v.string(),
});

/**
 * Cross-field invariants the structural schema cannot express.
 *
 * Each rule returns a stable issue `code` + path. Messages are
 * deliberately PII-free.
 */
function semanticChecks(
  m: MarketplaceManifest,
): { code: string; path: readonly (string | number)[]; message: string }[] {
  const issues: { code: string; path: readonly (string | number)[]; message: string }[] =
    [];

  if (!ID_RE.test(m.id)) {
    issues.push({
      code: 'INVALID_ID_FORMAT',
      path: ['id'],
      message: 'id must match /^(@scope/)?name(:variant)?/ in lowercase',
    });
  }
  if (!SEMVER_RE.test(m.version)) {
    issues.push({
      code: 'INVALID_SEMVER',
      path: ['version'],
      message: 'version must be a SemVer 2.0 string',
    });
  }
  if (m.maintainers.length === 0) {
    issues.push({
      code: 'NO_MAINTAINERS',
      path: ['maintainers'],
      message: 'manifest must list at least one maintainer',
    });
  }
  if (m.official && !m.id.startsWith(OFFICIAL_PREFIX)) {
    issues.push({
      code: 'OFFICIAL_FLAG_NOT_ALLOWED',
      path: ['official'],
      message: `official=true is reserved for ids prefixed with "${OFFICIAL_PREFIX}"`,
    });
  }
  if (m.kind === 'component' && m.supportedLayers.length === 0) {
    issues.push({
      code: 'NO_SUPPORTED_LAYERS',
      path: ['supportedLayers'],
      message: 'a component manifest must declare at least one supported layer',
    });
  }
  if (m.privacy.localOnly && m.privacy.memoryDomainsWritten.length > 0) {
    // localOnly may still write to local storage — we permit this and only
    // forbid explicit cross-domain writes when localOnly is asserted.
    const writesEnriched = m.privacy.memoryDomainsWritten.some(
      (d) => d === 'tech_pulse' || d === 'social',
    );
    if (writesEnriched) {
      issues.push({
        code: 'LOCAL_ONLY_VIOLATION',
        path: ['privacy', 'memoryDomainsWritten'],
        message:
          'localOnly=true contradicts writing to shared domains (tech_pulse, social)',
      });
    }
  }
  return issues;
}

/**
 * Validate an unknown payload as a marketplace manifest.
 *
 * @param input — raw JSON value as received from a publish endpoint.
 * @returns success with a typed manifest, or a `ValidationError` whose
 *          `issues[]` describe every problem found in one pass.
 */
export function validateManifest(
  input: unknown,
): Result<MarketplaceManifest, ValidationError> {
  // Discriminate on `kind` first so we run the right structural schema.
  const kindProbe = v.object({ kind: v.enum(['component', 'protocol-adapter'] as const) });
  const probe = kindProbe.validate(input);
  if (!probe.success) {
    return probe;
  }

  const structural =
    probe.data.kind === 'component'
      ? componentSchema.validate(input)
      : adapterSchema.validate(input);
  if (!structural.success) {
    return structural;
  }

  // Structural validator's inferred type carries `string | undefined` for
  // optional fields; our public types use `field?: string` under
  // `exactOptionalPropertyTypes`. Both shapes are runtime-equivalent for
  // present-vs-missing distinction, so a controlled narrowing cast is
  // sound here.
  const manifest = structural.data as unknown as MarketplaceManifest;

  const issues = semanticChecks(manifest);
  const [first, ...rest] = issues;
  if (first === undefined) {
    return ok(manifest);
  }

  const validationIssues: readonly ValidationIssue[] = [first, ...rest].map(
    (i) => ({
      path: i.path,
      expected: i.code,
      received: 'invalid',
      message: i.message,
    }),
  );
  const error: ValidationError = {
    code: 'VALIDATION_ERROR',
    message:
      issues.length === 1
        ? first.message
        : `${issues.length} semantic validation issues; first: ${first.message}`,
    details: {
      path: first.path,
      expected: first.code,
      received: 'invalid',
      issues: validationIssues,
    },
  };
  return err(error);
}

/** Type guard convenience wrapper. */
export function isMarketplaceManifest(input: unknown): input is MarketplaceManifest {
  return validateManifest(input).success;
}
