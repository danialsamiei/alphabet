/**
 * @file privacy.test.ts
 * @description Tests for PII redaction + consent-aware context injection.
 */

import { describe, it, expect } from 'vitest';
import {
  redactPromptString,
  redactPromptPII,
  injectConsentAwareContext,
} from './index.js';
import type { AlphabetChatMessage } from '../types.js';
import type { AlphabetToolContext } from '../../contract.js';

describe('redactPromptString', () => {
  it('redacts email addresses', () => {
    const r = redactPromptString('contact me at jane.doe@example.com please');
    expect(r.text).not.toContain('jane.doe@example.com');
    expect(r.text).toContain('[email]');
    expect(r.report.redactedCount).toBe(1);
  });
  it('redacts phone-like strings', () => {
    const r = redactPromptString('call +1 (415) 555-2671 today');
    expect(r.text).toContain('[phone]');
  });
  it('redacts JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const r = redactPromptString(`token: ${jwt}`);
    expect(r.text).toContain('[jwt]');
  });
  it('redacts AWS access keys', () => {
    const r = redactPromptString('AKIAIOSFODNN7EXAMPLE here');
    expect(r.text).toContain('[aws-access-key]');
  });
  it('returns input unchanged when nothing matches', () => {
    const r = redactPromptString('plain text without secrets');
    expect(r.text).toBe('plain text without secrets');
    expect(r.report.redactedCount).toBe(0);
  });
});

describe('redactPromptPII', () => {
  it('aggregates redaction across messages', () => {
    const msgs: AlphabetChatMessage[] = [
      { role: 'user', content: 'email: a@b.co' },
      { role: 'assistant', content: 'phone: +1 415 555 2671' },
    ];
    const r = redactPromptPII(msgs);
    expect(r.report.redactedCount).toBe(2);
    expect(r.report.kinds.sort()).toEqual(['email', 'phone']);
    expect(r.messages[0]?.content).toContain('[email]');
  });
  it('preserves message references when nothing changes', () => {
    const msgs: AlphabetChatMessage[] = [{ role: 'user', content: 'hello' }];
    const r = redactPromptPII(msgs);
    expect(r.messages[0]).toBe(msgs[0]);
  });
});

describe('injectConsentAwareContext', () => {
  const baseContext: AlphabetToolContext = {
    visitorId: 'vst_abc',
    sessionId: 'sess_xyz',
    consentTier: 'CONSENTED',
    locale: 'en-US',
    country: 'US',
    layer: 'CSS_3D',
    privacyRestricted: false,
  };

  it('always emits the consent tier', () => {
    const sys = injectConsentAwareContext(baseContext, {
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(sys.role).toBe('system');
    expect(sys.content).toContain('consent_tier: CONSENTED');
  });

  it('omits personalization fields when DNT is on', () => {
    const sys = injectConsentAwareContext(baseContext, {
      privacy: { dntEnabled: true, gpcEnabled: false },
    });
    expect(sys.content).toContain('privacy_signal');
    expect(sys.content).not.toContain('country: US');
    expect(sys.content).not.toContain('ui_layer: CSS_3D');
  });

  it('omits personalization when privacyRestricted is true', () => {
    const ctx: AlphabetToolContext = { ...baseContext, privacyRestricted: true };
    const sys = injectConsentAwareContext(ctx, {
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(sys.content).not.toContain('country: US');
  });

  it('emits country and layer when consent allows', () => {
    const sys = injectConsentAwareContext(baseContext, {
      privacy: { dntEnabled: false, gpcEnabled: false },
    });
    expect(sys.content).toContain('country: US');
    expect(sys.content).toContain('ui_layer: CSS_3D');
  });

  it('honours custom preamble', () => {
    const sys = injectConsentAwareContext(baseContext, {
      privacy: { dntEnabled: false, gpcEnabled: false },
      preamble: 'CUSTOM-PREAMBLE',
    });
    expect(sys.content.startsWith('CUSTOM-PREAMBLE')).toBe(true);
  });
});
