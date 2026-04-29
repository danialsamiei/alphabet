/**
 * @file storage.test.ts
 * @description Tests for consent storage adapters and ConsentTierManager
 * rehydration / persistence behaviour.
 */

import { describe, it, expect, vi } from 'vitest';
import { ConsentTierManager } from '../consent-tier-manager.js';
import type { ConsentSnapshot } from '../consent-tier-manager.js';
import type { SyncConsentStorageAdapter } from './types.js';
import { InMemoryConsentStorage } from './in-memory.js';
import {
  WebStorageConsentStorage,
  DEFAULT_CONSENT_STORAGE_KEY,
} from './web-storage.js';

const POLICY_V1 = '2025-01-01';
const POLICY_V2 = '2025-04-01';

// ─── Fake DOM Storage ────────────────────────────────────────────────────────

/** Minimal in-memory Storage implementation for tests. */
class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

// ─── InMemoryConsentStorage ──────────────────────────────────────────────────

describe('InMemoryConsentStorage', () => {
  it('returns null when nothing has been saved', () => {
    expect(new InMemoryConsentStorage().load()).toBeNull();
  });

  it('round-trips a snapshot', () => {
    const storage = new InMemoryConsentStorage();
    const snap: ConsentSnapshot = {
      state: 'granted',
      tier: 'CONSENTED',
      policyVersion: POLICY_V1,
      grantedAt: '2025-04-01T10:00:00.000Z',
    };
    storage.save(snap);
    expect(storage.load()).toEqual(snap);
  });

  it('clear() removes the saved snapshot', () => {
    const storage = new InMemoryConsentStorage();
    storage.save({ state: 'granted', tier: 'ANONYMOUS', policyVersion: POLICY_V1 });
    storage.clear();
    expect(storage.load()).toBeNull();
  });
});

// ─── WebStorageConsentStorage ────────────────────────────────────────────────

describe('WebStorageConsentStorage — basics', () => {
  it('uses the default key when none is provided', () => {
    const fake = new FakeStorage();
    const storage = new WebStorageConsentStorage({ storage: fake });
    storage.save({ state: 'pending', tier: 'NO_MEMORY', policyVersion: POLICY_V1 });
    expect(fake.getItem(DEFAULT_CONSENT_STORAGE_KEY)).not.toBeNull();
  });

  it('honours a custom key', () => {
    const fake = new FakeStorage();
    const storage = new WebStorageConsentStorage({ storage: fake, key: 'alphabet-test' });
    storage.save({ state: 'pending', tier: 'NO_MEMORY', policyVersion: POLICY_V1 });
    expect(fake.getItem('alphabet-test')).not.toBeNull();
    expect(fake.getItem(DEFAULT_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('round-trips a full snapshot including optional timestamps', () => {
    const fake = new FakeStorage();
    const storage = new WebStorageConsentStorage({ storage: fake });
    const snap: ConsentSnapshot = {
      state: 'granted',
      tier: 'ENRICHED',
      policyVersion: POLICY_V2,
      grantedAt: '2025-04-01T10:00:00.000Z',
      lastReason: 'grant',
    };
    storage.save(snap);
    expect(storage.load()).toEqual(snap);
  });

  it('persists schemaVersion field in the wire format', () => {
    const fake = new FakeStorage();
    const storage = new WebStorageConsentStorage({ storage: fake });
    storage.save({ state: 'pending', tier: 'NO_MEMORY', policyVersion: POLICY_V1 });
    const raw = fake.getItem(DEFAULT_CONSENT_STORAGE_KEY) as string;
    expect(JSON.parse(raw).schemaVersion).toBe(1);
  });

  it('clear() removes the entry', () => {
    const fake = new FakeStorage();
    const storage = new WebStorageConsentStorage({ storage: fake });
    storage.save({ state: 'pending', tier: 'NO_MEMORY', policyVersion: POLICY_V1 });
    storage.clear();
    expect(fake.getItem(DEFAULT_CONSENT_STORAGE_KEY)).toBeNull();
  });
});

describe('WebStorageConsentStorage — fail-safe behaviour', () => {
  it('returns null when no DOM Storage is available and no fallback used', () => {
    const storage = new WebStorageConsentStorage({ storage: undefined });
    // Cannot guarantee globalThis.localStorage is absent in test env, so
    // we drive an explicit getItem-throwing storage instead:
    const broken = new FakeStorage();
    vi.spyOn(broken, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const broken2 = new WebStorageConsentStorage({ storage: broken });
    expect(broken2.load()).toBeNull();
    expect(storage).toBeDefined(); // sanity
  });

  it('returns null on malformed JSON and purges the entry', () => {
    const fake = new FakeStorage();
    fake.setItem(DEFAULT_CONSENT_STORAGE_KEY, 'not-json{');
    const storage = new WebStorageConsentStorage({ storage: fake });
    expect(storage.load()).toBeNull();
    expect(fake.getItem(DEFAULT_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('rejects payloads with unknown schemaVersion', () => {
    const fake = new FakeStorage();
    fake.setItem(
      DEFAULT_CONSENT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 999,
        state: 'granted',
        tier: 'CONSENTED',
        policyVersion: POLICY_V1,
      })
    );
    const storage = new WebStorageConsentStorage({ storage: fake });
    expect(storage.load()).toBeNull();
    expect(fake.getItem(DEFAULT_CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('rejects invalid state / tier values', () => {
    const fake = new FakeStorage();
    fake.setItem(
      DEFAULT_CONSENT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        state: 'BOGUS',
        tier: 'NOPE',
        policyVersion: POLICY_V1,
      })
    );
    const storage = new WebStorageConsentStorage({ storage: fake });
    expect(storage.load()).toBeNull();
  });

  it('drops bad ISO timestamps but keeps the rest of the snapshot', () => {
    const fake = new FakeStorage();
    fake.setItem(
      DEFAULT_CONSENT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        state: 'granted',
        tier: 'ANONYMOUS',
        policyVersion: POLICY_V1,
        grantedAt: 'not-a-date',
      })
    );
    const storage = new WebStorageConsentStorage({ storage: fake });
    const snap = storage.load();
    expect(snap).not.toBeNull();
    expect(snap?.grantedAt).toBeUndefined();
    expect(snap?.tier).toBe('ANONYMOUS');
  });

  it('save() swallows quota / security exceptions silently', () => {
    const fake = new FakeStorage();
    vi.spyOn(fake, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const storage = new WebStorageConsentStorage({ storage: fake });
    expect(() =>
      storage.save({ state: 'pending', tier: 'NO_MEMORY', policyVersion: POLICY_V1 })
    ).not.toThrow();
  });
});

// ─── ConsentTierManager × storage integration ────────────────────────────────

describe('ConsentTierManager — storage rehydration', () => {
  it('rehydrates a granted snapshot when policyVersion matches', () => {
    const storage = new InMemoryConsentStorage();
    const a = new ConsentTierManager({ policyVersion: POLICY_V1, storage });
    a.grant('CONSENTED');

    const b = new ConsentTierManager({ policyVersion: POLICY_V1, storage });
    const snap = b.snapshot();
    expect(snap.state).toBe('granted');
    expect(snap.tier).toBe('CONSENTED');
    expect(b.canStoreMemory()).toBe(true);
    expect(b.canPersonalize()).toBe(true);
  });

  it('persists every state transition (grant, revoke, reset, downgrade)', () => {
    const storage = new InMemoryConsentStorage();
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1, storage });

    mgr.grant('CONSENTED');
    expect(storage.load()?.state).toBe('granted');
    expect(storage.load()?.tier).toBe('CONSENTED');

    mgr.downgradeOnPrivacySignal({ dntEnabled: true, gpcEnabled: false });
    expect(storage.load()?.tier).toBe('NO_MEMORY');
    expect(storage.load()?.lastReason).toBe('dnt');

    mgr.revoke();
    expect(storage.load()?.state).toBe('revoked');

    mgr.reset();
    // reset → storage is CLEARED, not overwritten with a pending snapshot
    expect(storage.load()).toBeNull();
  });

  it('invalidates a persisted snapshot when policyVersion differs', () => {
    const storage = new InMemoryConsentStorage();
    const a = new ConsentTierManager({ policyVersion: POLICY_V1, storage });
    a.grant('ENRICHED');

    // Re-construct with a NEW policy version → should auto-invalidate.
    const b = new ConsentTierManager({ policyVersion: POLICY_V2, storage });
    const snap = b.snapshot();
    expect(snap.state).toBe('pending');
    expect(snap.tier).toBe('NO_MEMORY');
    expect(snap.lastReason).toBe(`policy_change:${POLICY_V1}->${POLICY_V2}`);
    // The invalidated snapshot is flushed back so subsequent loads agree.
    expect(storage.load()?.state).toBe('pending');
    expect(storage.load()?.policyVersion).toBe(POLICY_V2);
  });

  it('writes nothing when no storage adapter is supplied', () => {
    const storage = new InMemoryConsentStorage();
    // Manager without storage should not touch the foreign storage.
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1 });
    mgr.grant('CONSENTED');
    expect(storage.load()).toBeNull();
  });

  it('survives storage adapter errors during persistence', () => {
    const errorAdapter: SyncConsentStorageAdapter = {
      load: () => null,
      save: () => {
        throw new Error('disk full');
      },
      clear: () => {},
    };
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1, storage: errorAdapter });
    // grant() must still succeed even if persistence fails.
    const result = mgr.grant('CONSENTED');
    expect(result.success).toBe(true);
    expect(mgr.snapshot().tier).toBe('CONSENTED');
  });

  it('survives storage adapter errors during clear (reset)', () => {
    const adapter: SyncConsentStorageAdapter = {
      load: () => null,
      save: () => {},
      clear: () => {
        throw new Error('locked');
      },
    };
    const mgr = new ConsentTierManager({ policyVersion: POLICY_V1, storage: adapter });
    mgr.grant('ANONYMOUS');
    expect(() => mgr.reset()).not.toThrow();
    expect(mgr.snapshot().state).toBe('pending');
  });

  it('integrates ConsentTierManager with WebStorageConsentStorage end-to-end', () => {
    const fake = new FakeStorage();
    const storage = new WebStorageConsentStorage({ storage: fake });

    const a = new ConsentTierManager({ policyVersion: POLICY_V1, storage });
    a.grant('CONSENTED');

    // simulate a page reload by constructing a fresh manager backed by
    // the same DOM storage.
    const storage2 = new WebStorageConsentStorage({ storage: fake });
    const b = new ConsentTierManager({ policyVersion: POLICY_V1, storage: storage2 });
    expect(b.snapshot().state).toBe('granted');
    expect(b.snapshot().tier).toBe('CONSENTED');

    b.revoke();
    const storage3 = new WebStorageConsentStorage({ storage: fake });
    const c = new ConsentTierManager({ policyVersion: POLICY_V1, storage: storage3 });
    expect(c.snapshot().state).toBe('revoked');
  });
});
