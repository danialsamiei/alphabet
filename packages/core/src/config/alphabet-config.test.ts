/**
 * @file alphabet-config.test.ts
 * @description Unit tests for AlphabetConfig class.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AlphabetConfig } from './alphabet-config.js';

// Helper para acceder a process.env de forma tipo-segura en tests
const getTestEnv = (): Record<string, string | undefined> => {
   
  return (globalThis as any)['process']?.['env'] ?? {};
};

const setTestEnv = (key: string, value: string | undefined): void => {
   
  const env = (globalThis as any)['process']?.['env'];
  if (env) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
};

describe('AlphabetConfig.fromOptions()', () => {
  it('should succeed with valid minimal options', () => {
    const result = AlphabetConfig.fromOptions({ apiBaseUrl: 'http://localhost:3000/api' });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for unspecified options', () => {
    const result = AlphabetConfig.fromOptions({ apiBaseUrl: 'http://localhost:3000/api' });
    expect(result.success).toBe(true);
    if (result.success) {
      const { options } = result.data;
      expect(options.timeoutMs).toBe(5000);
      expect(options.maxRetries).toBe(3);
      expect(options.defaultConsentTier).toBe('NO_MEMORY');
      expect(options.logLevel).toBe('info');
      expect(options.enableTelemetry).toBe(false);
      expect(options.tokenTier).toBe('ANONYMOUS');
      expect(options.defaultCountry).toBe('IR');
      expect(options.defaultLanguage).toBe('fa');
    }
  });

  it('should use provided values over defaults', () => {
    const result = AlphabetConfig.fromOptions({
      apiBaseUrl: 'https://api.example.com',
      timeoutMs: 10000,
      logLevel: 'debug',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const { options } = result.data;
      expect(options.apiBaseUrl).toBe('https://api.example.com');
      expect(options.timeoutMs).toBe(10000);
      expect(options.logLevel).toBe('debug');
    }
  });

  it('should fail with empty apiBaseUrl', () => {
    const result = AlphabetConfig.fromOptions({ apiBaseUrl: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_API_BASE_URL');
    }
  });

  it('should fail with invalid apiBaseUrl (no http/https)', () => {
    const result = AlphabetConfig.fromOptions({ apiBaseUrl: 'ftp://example.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_API_BASE_URL');
    }
  });

  it('should fail with negative timeoutMs', () => {
    const result = AlphabetConfig.fromOptions({
      apiBaseUrl: 'http://localhost:3000',
      timeoutMs: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_TIMEOUT');
    }
  });

  it('should fail with negative maxRetries', () => {
    const result = AlphabetConfig.fromOptions({
      apiBaseUrl: 'http://localhost:3000',
      maxRetries: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_MAX_RETRIES');
    }
  });

  it('should fail with invalid consentTier', () => {
    const result = AlphabetConfig.fromOptions({
      apiBaseUrl: 'http://localhost:3000',
      defaultConsentTier: 'INVALID' as never,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_CONSENT_TIER');
    }
  });

  it('should fail with invalid logLevel', () => {
    const result = AlphabetConfig.fromOptions({
      apiBaseUrl: 'http://localhost:3000',
      logLevel: 'verbose' as never,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_LOG_LEVEL');
    }
  });
});

describe('AlphabetConfig.fromEnv()', () => {
  beforeEach(() => {
    setTestEnv('ALPHABET_API_BASE_URL', 'http://localhost:3000/api');
    setTestEnv('ALPHABET_TIMEOUT_MS', undefined);
    setTestEnv('ALPHABET_MAX_RETRIES', undefined);
    setTestEnv('ALPHABET_LOG_LEVEL', undefined);
  });

  afterEach(() => {
    setTestEnv('ALPHABET_API_BASE_URL', undefined);
    setTestEnv('ALPHABET_TIMEOUT_MS', undefined);
    setTestEnv('ALPHABET_MAX_RETRIES', undefined);
    setTestEnv('ALPHABET_LOG_LEVEL', undefined);
  });

  it('should read ALPHABET_API_BASE_URL from env', () => {
    setTestEnv('ALPHABET_API_BASE_URL', 'http://localhost:9000/api');
    const result = AlphabetConfig.fromEnv();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options.apiBaseUrl).toBe('http://localhost:9000/api');
    }
  });

  it('should read ALPHABET_TIMEOUT_MS from env', () => {
    setTestEnv('ALPHABET_TIMEOUT_MS', '8000');
    const result = AlphabetConfig.fromEnv();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options.timeoutMs).toBe(8000);
    }
  });

  it('should allow overrides to take precedence over env', () => {
    setTestEnv('ALPHABET_TIMEOUT_MS', '3000');
    const result = AlphabetConfig.fromEnv({ timeoutMs: 9999 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options.timeoutMs).toBe(9999);
    }
  });
});
