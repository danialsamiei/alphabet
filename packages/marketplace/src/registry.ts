/**
 * @module @alphabet/marketplace/registry
 * @description
 * Pluggable registry for marketplace entries.
 *
 * The registry is intentionally minimal and *synchronous* in its
 * in-memory form, so that it can be used inside a deterministic test
 * suite, a CI step, or an edge function. A future REST-backed adapter
 * can implement the same `Registry` interface by returning Promises;
 * synchronous callers will need to migrate at that point. Until then,
 * everything stays sync to keep the surface tiny.
 */

import type { Result, AlphabetError } from '@alphabet/core';
import { err, ok } from '@alphabet/core';

import { validateManifest } from './manifest.js';
import type {
  EntryKind,
  MarketplaceManifest,
  RequiredConsentTier,
} from './types.js';

/** Filters accepted by {@link Registry.list}. */
export interface RegistryQuery {
  readonly kind?: EntryKind;
  readonly tag?: string;
  /** Caller's currently granted consent tier. */
  readonly maxConsentTier?: RequiredConsentTier;
  /** Substring matched against id, title, and tags (case-insensitive). */
  readonly text?: string;
  /** When `true`, only entries authored by the Alphabet core team. */
  readonly officialOnly?: boolean;
}

/**
 * Registry contract. Implementations may persist entries to memory, a
 * REST service, a static JSON file, or a content-addressed store.
 */
export interface Registry {
  publish(input: unknown): Result<MarketplaceManifest, AlphabetError>;
  get(id: string): Result<MarketplaceManifest, AlphabetError>;
  list(query?: RegistryQuery): readonly MarketplaceManifest[];
  remove(id: string): Result<void, AlphabetError>;
  size(): number;
}

/**
 * In-process registry useful for tests, the demo app, and bootstrapping
 * a real backend. Storage is a simple `Map`, keyed by `manifest.id`.
 *
 * Concurrency: not safe for multi-writer scenarios. The intended use
 * is single-threaded JS — add coordination at the host layer if you
 * need it.
 */
export class InMemoryRegistry implements Registry {
  private readonly entries = new Map<string, MarketplaceManifest>();

  /**
   * Validate and store a manifest. Returns the stored manifest on
   * success. The author cannot overwrite an existing version unless
   * the new version's SemVer is strictly greater (string compare is
   * sufficient for the limited subset we accept; see manifest.ts).
   */
  publish(input: unknown): Result<MarketplaceManifest, AlphabetError> {
    const validated = validateManifest(input);
    if (!validated.success) {
      return validated;
    }
    const next = validated.data;
    const existing = this.entries.get(next.id);
    if (existing && !isStrictlyNewer(next.version, existing.version)) {
      return err({
        code: 'VERSION_NOT_NEWER',
        message: 'a publish must increase the manifest version',
        details: { id: next.id, existing: existing.version, incoming: next.version },
      });
    }
    this.entries.set(next.id, next);
    return ok(next);
  }

  get(id: string): Result<MarketplaceManifest, AlphabetError> {
    const found = this.entries.get(id);
    if (!found) {
      return err({
        code: 'NOT_FOUND',
        message: 'no entry with the given id',
        details: { id },
      });
    }
    return ok(found);
  }

  list(query: RegistryQuery = {}): readonly MarketplaceManifest[] {
    const text = query.text?.toLowerCase();
    const out: MarketplaceManifest[] = [];
    for (const m of this.entries.values()) {
      if (query.kind && m.kind !== query.kind) continue;
      if (query.officialOnly && !m.official) continue;
      if (query.tag && !m.tags.includes(query.tag)) continue;
      if (
        query.maxConsentTier !== undefined &&
        m.privacy.requiredConsentTier > query.maxConsentTier
      )
        continue;
      if (text) {
        const haystack = `${m.id} ${m.title} ${m.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(text)) continue;
      }
      out.push(m);
    }
    // Stable, consumer-friendly ordering: official first, then id A→Z.
    out.sort((a, b) => {
      if (a.official !== b.official) return a.official ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }

  remove(id: string): Result<void, AlphabetError> {
    if (!this.entries.delete(id)) {
      return err({
        code: 'NOT_FOUND',
        message: 'no entry with the given id',
        details: { id },
      });
    }
    return ok(undefined);
  }

  size(): number {
    return this.entries.size;
  }
}

/**
 * Strict SemVer comparison just sufficient for the manifest format we
 * accept. We intentionally do not pull in a SemVer dependency; the
 * marketplace will reject manifests whose version doesn't match the
 * SemVer regex in `./manifest.ts`, so the inputs here are well-formed.
 */
function isStrictlyNewer(a: string, b: string): boolean {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) return ai > bi;
  }
  // Equal core; treat as not newer (we don't reason about pre-release).
  return false;
}

function parseSemVer(s: string): readonly number[] {
  const core = s.split(/[-+]/, 1)[0] ?? '0.0.0';
  return core.split('.').map((n) => Number.parseInt(n, 10) || 0);
}
