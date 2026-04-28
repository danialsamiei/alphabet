/**
 * Tests for the rate-limit header parsers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRateLimit, parseRetryAfterMs } from '../../src/transport/rate-limit.js';

describe('transport/rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses Retry-After delta-seconds', () => {
    const headers = new Headers({ 'Retry-After': '30' });
    expect(parseRetryAfterMs(headers)).toBe(30_000);
  });

  it('parses Retry-After fractional seconds', () => {
    const headers = new Headers({ 'Retry-After': '0.5' });
    expect(parseRetryAfterMs(headers)).toBe(500);
  });

  it('parses Retry-After HTTP-date', () => {
    const headers = new Headers({ 'Retry-After': 'Thu, 01 Jan 2026 00:00:30 GMT' });
    expect(parseRetryAfterMs(headers)).toBe(30_000);
  });

  it('returns 0 for past Retry-After dates', () => {
    const headers = new Headers({ 'Retry-After': 'Thu, 01 Jan 2025 00:00:00 GMT' });
    expect(parseRetryAfterMs(headers)).toBe(0);
  });

  it('returns undefined for missing/garbage Retry-After', () => {
    expect(parseRetryAfterMs(new Headers())).toBeUndefined();
    expect(parseRetryAfterMs(new Headers({ 'Retry-After': 'tomorrow' }))).toBeUndefined();
  });

  it('parses GitHub-style X-RateLimit-* triplet', () => {
    const headers = new Headers({
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': '7',
      'X-RateLimit-Reset': '1767225600', // 2026-01-01T00:00:00Z
    });
    expect(parseRateLimit(headers)).toEqual({
      limit: 60,
      remaining: 7,
      resetEpochSec: 1767225600,
    });
  });

  it('treats small X-RateLimit-Reset as delta-seconds (Cloudflare style)', () => {
    const headers = new Headers({ 'X-RateLimit-Reset': '15' });
    const info = parseRateLimit(headers);
    expect(info.resetEpochSec).toBe(Math.floor(Date.now() / 1000) + 15);
  });

  it('combines Retry-After into the snapshot when present', () => {
    const headers = new Headers({
      'X-RateLimit-Remaining': '0',
      'Retry-After': '5',
    });
    expect(parseRateLimit(headers).retryAfterMs).toBe(5_000);
  });

  it('returns an empty info when no headers are present', () => {
    expect(parseRateLimit(new Headers())).toEqual({});
  });
});
