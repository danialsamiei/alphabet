/**
 * @file routes.test.ts
 * @description Tests for the Alphabet route contract and base-URL normalization.
 */

import { describe, it, expect } from 'vitest';
import {
  API_VERSION_PREFIX,
  LEGACY_API_PREFIX,
  ALPHABET_ROUTES,
  ALPHABET_ROUTE_STATUS,
  fullRoute,
  joinRoute,
  normalizeApiBaseUrl,
} from './routes.js';

describe('API_VERSION_PREFIX', () => {
  it('is the canonical /api/alphabet/v1 prefix', () => {
    expect(API_VERSION_PREFIX).toBe('/api/alphabet/v1');
  });

  it('is distinct from the legacy /api prefix', () => {
    expect(LEGACY_API_PREFIX).toBe('/api');
    expect(API_VERSION_PREFIX).not.toBe(LEGACY_API_PREFIX);
  });
});

describe('ALPHABET_ROUTES', () => {
  it('exposes all 16 documented endpoints', () => {
    // All 16 endpoint identifiers (Memory has store/read/delete sharing one path).
    const expected = [
      'contextHandshake',
      'contextConsent',
      'contextPreference',
      'interact',
      'voiceTranscribe',
      'suggestions',
      'technologyPulse',
      'technologyPulseBrief',
      'visitorMemoryStore',
      'visitorMemoryRead',
      'visitorMemoryDelete',
      'clawQuery',
      'clawIngest',
      'clawAdminAudit',
      'adminVisitorInsights',
      'adminPulseSources',
    ];
    expect(Object.keys(ALPHABET_ROUTES).sort()).toEqual(expected.sort());
  });

  it('every route path starts with a "/" and contains no version prefix', () => {
    for (const path of Object.values(ALPHABET_ROUTES)) {
      expect(path.startsWith('/')).toBe(true);
      expect(path.startsWith(API_VERSION_PREFIX)).toBe(false);
    }
  });

  it('produces the expected canonical paths', () => {
    expect(ALPHABET_ROUTES.contextHandshake).toBe('/context/handshake');
    expect(ALPHABET_ROUTES.contextConsent).toBe('/context/consent');
    expect(ALPHABET_ROUTES.contextPreference).toBe('/context/preference');
    expect(ALPHABET_ROUTES.interact).toBe('/interact');
    expect(ALPHABET_ROUTES.voiceTranscribe).toBe('/voice/transcribe');
    expect(ALPHABET_ROUTES.suggestions).toBe('/suggestions');
    expect(ALPHABET_ROUTES.technologyPulse).toBe('/technology-pulse');
    expect(ALPHABET_ROUTES.technologyPulseBrief).toBe('/technology-pulse/brief');
    expect(ALPHABET_ROUTES.visitorMemoryStore).toBe('/visitor/memory');
    expect(ALPHABET_ROUTES.visitorMemoryRead).toBe('/visitor/memory');
    expect(ALPHABET_ROUTES.visitorMemoryDelete).toBe('/visitor/memory');
    expect(ALPHABET_ROUTES.clawQuery).toBe('/claw/query');
    expect(ALPHABET_ROUTES.clawIngest).toBe('/claw/ingest');
    expect(ALPHABET_ROUTES.clawAdminAudit).toBe('/claw/admin/audit');
    expect(ALPHABET_ROUTES.adminVisitorInsights).toBe('/admin/visitor-insights');
    expect(ALPHABET_ROUTES.adminPulseSources).toBe('/admin/technology-pulse/sources');
  });

  it('declares an implementation status for every route', () => {
    for (const key of Object.keys(ALPHABET_ROUTES) as Array<keyof typeof ALPHABET_ROUTES>) {
      expect(ALPHABET_ROUTE_STATUS[key]).toMatch(/^(implemented|planned)$/);
    }
  });
});

describe('fullRoute()', () => {
  it('prepends the canonical version prefix', () => {
    expect(fullRoute('contextHandshake')).toBe('/api/alphabet/v1/context/handshake');
    expect(fullRoute('adminPulseSources')).toBe('/api/alphabet/v1/admin/technology-pulse/sources');
  });
});

describe('normalizeApiBaseUrl()', () => {
  it('strips a single trailing slash from a bare origin', () => {
    expect(normalizeApiBaseUrl('https://example.com/')).toBe('https://example.com/api/alphabet/v1');
  });

  it('strips multiple trailing slashes from a bare origin', () => {
    expect(normalizeApiBaseUrl('https://example.com///')).toBe('https://example.com/api/alphabet/v1');
  });

  it('appends the canonical prefix when the URL has none', () => {
    expect(normalizeApiBaseUrl('https://example.com')).toBe('https://example.com/api/alphabet/v1');
    expect(normalizeApiBaseUrl('http://localhost:3000')).toBe('http://localhost:3000/api/alphabet/v1');
  });

  it('preserves the legacy /api suffix for backwards compatibility', () => {
    expect(normalizeApiBaseUrl('https://example.com/api')).toBe('https://example.com/api');
    expect(normalizeApiBaseUrl('http://localhost:3000/api')).toBe('http://localhost:3000/api');
  });

  it('strips the trailing slash from a legacy /api/ base', () => {
    expect(normalizeApiBaseUrl('https://example.com/api/')).toBe('https://example.com/api');
  });

  it('leaves an already-normalized canonical base URL alone', () => {
    expect(normalizeApiBaseUrl('https://example.com/api/alphabet/v1')).toBe(
      'https://example.com/api/alphabet/v1',
    );
  });

  it('strips the trailing slash from a canonical base URL', () => {
    expect(normalizeApiBaseUrl('https://example.com/api/alphabet/v1/')).toBe(
      'https://example.com/api/alphabet/v1',
    );
  });

  it('is idempotent', () => {
    const inputs = [
      'https://example.com',
      'https://example.com/',
      'https://example.com/api',
      'https://example.com/api/',
      'https://example.com/api/alphabet/v1',
      'https://example.com/api/alphabet/v1/',
    ];
    for (const input of inputs) {
      const once = normalizeApiBaseUrl(input);
      const twice = normalizeApiBaseUrl(once);
      expect(twice).toBe(once);
    }
  });

  it('does not confuse hostnames containing "api" with the legacy suffix', () => {
    expect(normalizeApiBaseUrl('https://api.example.com')).toBe(
      'https://api.example.com/api/alphabet/v1',
    );
  });

  it('treats /api as legacy when it is a path segment, even nested', () => {
    // The path *ends* in `/api`, which is a real path segment, so it
    // should be preserved as legacy and not double-prefixed.
    expect(normalizeApiBaseUrl('https://example.com/v2/api')).toBe(
      'https://example.com/v2/api',
    );
  });
});

describe('joinRoute()', () => {
  it('concatenates a normalized base with a route constant', () => {
    const base = normalizeApiBaseUrl('https://example.com');
    expect(joinRoute(base, ALPHABET_ROUTES.contextHandshake)).toBe(
      'https://example.com/api/alphabet/v1/context/handshake',
    );
  });

  it('preserves legacy /api callers', () => {
    const base = normalizeApiBaseUrl('https://example.com/api');
    expect(joinRoute(base, ALPHABET_ROUTES.suggestions)).toBe(
      'https://example.com/api/suggestions',
    );
  });
});

describe('routes contract <-> documented routes', () => {
  it('canonical full paths match the public API_REFERENCE table', () => {
    // This list is the source of truth surfaced in docs/API_REFERENCE.md
    // (after migration to /api/alphabet/v1). If you add a route, add it here too.
    const documented: Array<[keyof typeof ALPHABET_ROUTES, string]> = [
      ['contextHandshake', '/api/alphabet/v1/context/handshake'],
      ['contextConsent', '/api/alphabet/v1/context/consent'],
      ['contextPreference', '/api/alphabet/v1/context/preference'],
      ['interact', '/api/alphabet/v1/interact'],
      ['voiceTranscribe', '/api/alphabet/v1/voice/transcribe'],
      ['suggestions', '/api/alphabet/v1/suggestions'],
      ['technologyPulse', '/api/alphabet/v1/technology-pulse'],
      ['technologyPulseBrief', '/api/alphabet/v1/technology-pulse/brief'],
      ['visitorMemoryStore', '/api/alphabet/v1/visitor/memory'],
      ['visitorMemoryRead', '/api/alphabet/v1/visitor/memory'],
      ['visitorMemoryDelete', '/api/alphabet/v1/visitor/memory'],
      ['clawQuery', '/api/alphabet/v1/claw/query'],
      ['clawIngest', '/api/alphabet/v1/claw/ingest'],
      ['clawAdminAudit', '/api/alphabet/v1/claw/admin/audit'],
      ['adminVisitorInsights', '/api/alphabet/v1/admin/visitor-insights'],
      ['adminPulseSources', '/api/alphabet/v1/admin/technology-pulse/sources'],
    ];
    for (const [key, expectedPath] of documented) {
      expect(fullRoute(key)).toBe(expectedPath);
    }
  });
});
