/**
 * useAwafConsent — state machine + persistence + privacy signal lock.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAwafConsent, DEFAULT_CONSENT_STORAGE_KEY } from './useAwafConsent.js';

describe('useAwafConsent', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts in pending state with NO_MEMORY tier', () => {
    const { result } = renderHook(() => useAwafConsent());
    expect(result.current.state).toBe('pending');
    expect(result.current.tier).toBe('NO_MEMORY');
    expect(result.current.purposes).toEqual([]);
  });

  it('grant() upgrades to CONSENTED and persists to localStorage', () => {
    const { result } = renderHook(() => useAwafConsent());
    act(() => result.current.grant('CONSENTED', ['personalization']));
    expect(result.current.state).toBe('granted');
    expect(result.current.tier).toBe('CONSENTED');
    const raw = window.localStorage.getItem(DEFAULT_CONSENT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? '{}') as { tier: string; state: string };
    expect(stored.tier).toBe('CONSENTED');
    expect(stored.state).toBe('granted');
  });

  it('revoke() resets to NO_MEMORY/revoked', () => {
    const { result } = renderHook(() => useAwafConsent());
    act(() => result.current.grant('CONSENTED'));
    act(() => result.current.revoke());
    expect(result.current.state).toBe('revoked');
    expect(result.current.tier).toBe('NO_MEMORY');
    expect(result.current.purposes).toEqual([]);
  });

  it('reset() returns to pending', () => {
    const { result } = renderHook(() => useAwafConsent());
    act(() => result.current.grant('CONSENTED'));
    act(() => result.current.reset());
    expect(result.current.state).toBe('pending');
    expect(result.current.tier).toBe('NO_MEMORY');
  });

  it('hydrates from localStorage on mount', () => {
    const snapshot = {
      tier: 'ENRICHED',
      state: 'granted',
      purposes: ['personalization', 'behavioral_learning'],
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    window.localStorage.setItem(DEFAULT_CONSENT_STORAGE_KEY, JSON.stringify(snapshot));
    const { result } = renderHook(() => useAwafConsent());
    expect(result.current.tier).toBe('ENRICHED');
    expect(result.current.state).toBe('granted');
    expect(result.current.purposes).toContain('behavioral_learning');
  });

  it('locks to NO_MEMORY when DNT or GPC is active', () => {
    const { result } = renderHook(() =>
      useAwafConsent({ privacySignals: { dntEnabled: true, gpcEnabled: false } })
    );
    expect(result.current.lockedByPrivacySignal).toBe(true);
    expect(result.current.tier).toBe('NO_MEMORY');
    act(() => result.current.grant('ENRICHED'));
    // grant should be a no-op while locked.
    expect(result.current.tier).toBe('NO_MEMORY');
    expect(result.current.state).toBe('revoked');
  });

  it('uses isolated storageKey per options', () => {
    const { result } = renderHook(() => useAwafConsent({ storageKey: 'awaf:custom' }));
    act(() => result.current.grant('ANONYMOUS'));
    expect(window.localStorage.getItem('awaf:custom')).not.toBeNull();
    expect(window.localStorage.getItem(DEFAULT_CONSENT_STORAGE_KEY)).toBeNull();
  });
});
