/**
 * Tests for the MCP adapter — manifests, dispatch, consent gating, and
 * memory permission enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  ALPHABET_MCP_TOOLS,
  ALPHABET_MCP_TOOL_MANIFESTS,
  McpAdapter,
} from './index.js';
import { makeConsentScope } from '../normalizers/index.js';
import type { AlphabetProtocolRequest, AlphabetToolContext } from '../contract.js';

const baseContext: AlphabetToolContext = {
  visitorId: 'v-abc12345',
  sessionId: 'sess-1',
  consentTier: 'CONSENTED',
  privacyRestricted: false,
  country: 'US',
  layer: 'STATIC_HTML',
  locale: 'en-US',
};

function makeRequest(
  consentOps: readonly ('read_context' | 'read_memory' | 'personalize')[] = ['read_context']
): AlphabetProtocolRequest {
  return {
    protocol: 'MCP',
    operation: 'mcp.invoke',
    context: baseContext,
    consent: makeConsentScope('CONSENTED', { operations: consentOps }),
    payload: {},
    correlationId: 'corr-1',
    receivedAt: new Date().toISOString(),
  };
}

const noPrivacy = { dntEnabled: false, gpcEnabled: false } as const;

describe('Alphabet MCP tool manifests', () => {
  it('exposes all four tools with valid input schemas', () => {
    expect(ALPHABET_MCP_TOOLS).toEqual([
      'context_handshake',
      'memory_query',
      'consent_status',
      'adaptive_layer_explain',
    ]);
    for (const name of ALPHABET_MCP_TOOLS) {
      const m = ALPHABET_MCP_TOOL_MANIFESTS[name];
      expect(m.name).toBe(name);
      expect(typeof m.description).toBe('string');
      expect(m.inputSchema.type).toBe('object');
    }
  });
});

describe('McpAdapter.invoke', () => {
  it('returns a PII-free context for context_handshake', async () => {
    const adapter = new McpAdapter();
    const r = await adapter.invoke('context_handshake', {}, makeRequest(), noPrivacy);
    expect(r.success).toBe(true);
    if (r.success) {
      expect('context' in r.data).toBe(true);
    }
  });

  it('returns 404-style error for unknown tools', async () => {
    const adapter = new McpAdapter();
    const r = await adapter.invoke('nonexistent', {}, makeRequest(), noPrivacy);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('TOOL_NOT_FOUND');
  });

  it('denies memory_query when consent tier is NO_MEMORY', async () => {
    const adapter = new McpAdapter();
    const req: AlphabetProtocolRequest = {
      ...makeRequest(['read_memory']),
      context: { ...baseContext, consentTier: 'NO_MEMORY' },
      consent: makeConsentScope('NO_MEMORY', { operations: ['read_memory'] }),
    };
    const r = await adapter.invoke(
      'memory_query',
      { domain: 'general' },
      req,
      noPrivacy
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_INSUFFICIENT');
  });

  it('rejects unknown memory domains', async () => {
    const adapter = new McpAdapter();
    const r = await adapter.invoke(
      'memory_query',
      { domain: 'totally_made_up' },
      makeRequest(['read_memory']),
      noPrivacy
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('INVALID_PROTOCOL_PAYLOAD');
  });

  it('uses the injected memoryBackend when permission is granted', async () => {
    let calls = 0;
    const adapter = new McpAdapter({
      memoryBackend: async ({ domain, query, limit }) => {
        calls++;
        expect(domain).toBe('general');
        expect(query).toBe('hello');
        expect(limit).toBe(5);
        return [{ id: 'mem-1', snippet: 'hi' }];
      },
    });
    const r = await adapter.invoke(
      'memory_query',
      { domain: 'general', query: 'hello', limit: 5 },
      makeRequest(['read_memory']),
      noPrivacy
    );
    expect(calls).toBe(1);
    expect(r.success).toBe(true);
    if (r.success && 'entries' in r.data) {
      expect(r.data.entries).toHaveLength(1);
    }
  });

  it('returns consent_status with current tier and privacy flag', async () => {
    const adapter = new McpAdapter();
    const r = await adapter.invoke('consent_status', {}, makeRequest(), noPrivacy);
    expect(r.success).toBe(true);
    if (r.success && 'tier' in r.data) {
      expect(r.data.tier).toBe('CONSENTED');
      expect(r.data.privacyRestricted).toBe(false);
    }
  });

  it('returns adaptive_layer_explain reasons', async () => {
    const adapter = new McpAdapter({
      layerExplainer: () => ['device is desktop', 'network is fast'],
    });
    const r = await adapter.invoke(
      'adaptive_layer_explain',
      {},
      makeRequest(),
      noPrivacy
    );
    expect(r.success).toBe(true);
    if (r.success && 'layer' in r.data) {
      expect(r.data.layer).toBe('STATIC_HTML');
      expect(r.data.reasons.length).toBeGreaterThan(0);
    }
  });
});
