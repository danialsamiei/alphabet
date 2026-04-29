/**
 * @file consent-ladder.test.ts
 */

import { describe, it, expect } from 'vitest';
import { interpret, toMermaid } from './machine.js';
import { consentLadderMachine } from './consent-ladder.js';

describe('consentLadderMachine / happy path', () => {
  it('starts in pending with NO_MEMORY tier', () => {
    const a = interpret(consentLadderMachine).start();
    const s = a.getSnapshot();
    expect(s.value).toBe('pending');
    expect(s.context.tier).toBe('NO_MEMORY');
  });

  it('GRANT(ANONYMOUS) → granted with tier=ANONYMOUS', () => {
    const a = interpret(consentLadderMachine).start();
    a.send({ type: 'GRANT', tier: 'ANONYMOUS', at: 1, policyVersion: 'v1' });
    const s = a.getSnapshot();
    expect(s.value).toBe('granted');
    expect(s.context.tier).toBe('ANONYMOUS');
    expect(s.context.grantedAt).toBe(1);
  });

  it('upgrade ANONYMOUS → CONSENTED is allowed', () => {
    const a = interpret(consentLadderMachine).start();
    a.send({ type: 'GRANT', tier: 'ANONYMOUS', at: 1, policyVersion: 'v1' });
    a.send({ type: 'GRANT', tier: 'CONSENTED', at: 2, policyVersion: 'v1' });
    expect(a.getSnapshot().context.tier).toBe('CONSENTED');
  });

  it('downgrade is blocked by the isUpgrade guard', () => {
    const a = interpret(consentLadderMachine).start();
    a.send({ type: 'GRANT', tier: 'ENRICHED', at: 1, policyVersion: 'v1' });
    a.send({ type: 'GRANT', tier: 'ANONYMOUS', at: 2, policyVersion: 'v1' });
    expect(a.getSnapshot().context.tier).toBe('ENRICHED');
  });
});

describe('consentLadderMachine / revoke + reset', () => {
  it('REVOKE moves to revoked with tier=NO_MEMORY', () => {
    const a = interpret(consentLadderMachine).start();
    a.send({ type: 'GRANT', tier: 'CONSENTED', at: 1, policyVersion: 'v1' });
    a.send({ type: 'REVOKE', at: 2 });
    const s = a.getSnapshot();
    expect(s.value).toBe('revoked');
    expect(s.context.tier).toBe('NO_MEMORY');
    expect(s.context.revokedAt).toBe(2);
  });

  it('RESET from revoked → pending', () => {
    const a = interpret(consentLadderMachine).start();
    a.send({ type: 'GRANT', tier: 'CONSENTED', at: 1, policyVersion: 'v1' });
    a.send({ type: 'REVOKE', at: 2 });
    a.send({ type: 'RESET' });
    expect(a.getSnapshot().value).toBe('pending');
  });
});

describe('consentLadderMachine / policy invalidation', () => {
  it('POLICY_UPDATED from granted → pending and clears tier', () => {
    const a = interpret(consentLadderMachine).start();
    a.send({ type: 'GRANT', tier: 'CONSENTED', at: 1, policyVersion: 'v1' });
    a.send({ type: 'POLICY_UPDATED', policyVersion: 'v2' });
    const s = a.getSnapshot();
    expect(s.value).toBe('pending');
    expect(s.context.tier).toBe('NO_MEMORY');
    expect(s.context.policyVersion).toBe('v2');
  });
});

describe('consentLadderMachine / mermaid', () => {
  it('renders all four transitions', () => {
    const out = toMermaid(consentLadderMachine);
    expect(out).toContain('pending --> granted: GRANT [isValidTier]');
    expect(out).toContain('granted --> granted: GRANT [isUpgrade]');
    expect(out).toContain('granted --> revoked: REVOKE');
    expect(out).toContain('granted --> pending: POLICY_UPDATED');
    expect(out).toContain('revoked --> pending: RESET');
  });
});
