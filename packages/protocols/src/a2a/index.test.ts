/**
 * Tests for the A2A adapter — task normalization, skill mapping, and
 * consent / PII validation.
 */

import { describe, it, expect } from 'vitest';
import { A2AAdapter, ALPHABET_A2A_AGENT_CARD, type A2ATask } from './index.js';
import { makeConsentScope } from '../normalizers/index.js';
import type { AlphabetToolContext } from '../contract.js';

const ctx: AlphabetToolContext = {
  visitorId: 'v-abc12345',
  sessionId: 'sess-1',
  consentTier: 'ANONYMOUS',
  privacyRestricted: false,
  country: 'US',
};

const noPrivacy = { dntEnabled: false, gpcEnabled: false } as const;

function task(overrides: Partial<A2ATask> = {}): A2ATask {
  return {
    id: 'task-1',
    skill: 'context.handshake',
    messages: [{ role: 'user', parts: [{ kind: 'text', text: 'hi' }] }],
    metadata: {
      context: ctx,
      consent: makeConsentScope('ANONYMOUS', { operations: ['read_context'] }),
    },
    ...overrides,
  };
}

describe('A2AAdapter.getAgentCard', () => {
  it('returns a frozen agent card with the documented skills', () => {
    const adapter = new A2AAdapter();
    const card = adapter.getAgentCard();
    expect(card).toBe(ALPHABET_A2A_AGENT_CARD);
    expect(card.skills.map((s) => s.id).sort()).toEqual([
      'consent.status',
      'context.handshake',
      'memory.query',
    ]);
  });
});

describe('A2AAdapter.normalizeTask', () => {
  it('normalizes a valid task into AlphabetProtocolRequest', () => {
    const adapter = new A2AAdapter();
    const r = adapter.normalizeTask(task(), { tier: 'ANONYMOUS', privacy: noPrivacy });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.protocol).toBe('A2A');
      expect(r.data.operation).toBe('context.handshake');
      expect(r.data.payload.messages).toHaveLength(1);
      expect(r.data.correlationId).toBe('a2a-task-1');
    }
  });

  it('rejects unknown skills', () => {
    const adapter = new A2AAdapter();
    const r = adapter.normalizeTask(task({ skill: 'mystery' }), {
      tier: 'ANONYMOUS',
      privacy: noPrivacy,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('UNSUPPORTED_PROTOCOL');
  });

  it('rejects tasks without metadata', () => {
    const adapter = new A2AAdapter();
    const bad = { ...task() } as A2ATask & { metadata?: unknown };
    bad.metadata = undefined;
    const r = adapter.normalizeTask(bad as A2ATask, {
      tier: 'ANONYMOUS',
      privacy: noPrivacy,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('TASK_INVALID');
  });

  it('honours custom skill maps', () => {
    const adapter = new A2AAdapter({ skillMap: { 'custom.skill': 'context.handshake' } });
    const r = adapter.normalizeTask(task({ skill: 'custom.skill' }), {
      tier: 'ANONYMOUS',
      privacy: noPrivacy,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.operation).toBe('context.handshake');
  });

  it('overrides client-claimed tier with the authoritative tier', () => {
    const adapter = new A2AAdapter();
    const t = task({
      metadata: {
        context: { ...ctx, consentTier: 'ENRICHED' },
        consent: makeConsentScope('ENRICHED', { operations: ['read_memory'] }),
      },
      skill: 'memory.query',
    });
    const r = adapter.normalizeTask(t, { tier: 'NO_MEMORY', privacy: noPrivacy });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_INSUFFICIENT');
  });
});
