/**
 * @file brands.test.ts
 * @description Unit tests for Brand Types and factory functions.
 */

import { describe, it, expect } from 'vitest';
import {
  createVisitorId,
  createSessionId,
  createMemoryId,
  createRequestId,
  generateConsentToken,
  generateConfirmationId,
  createAuditLogId,
  type VisitorId,
} from './brands.js';

describe('createVisitorId()', () => {
  it('should succeed with a valid ID (>= 8 chars)', () => {
    const result = createVisitorId('v-abc12345');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('v-abc12345');
    }
  });

  it('should fail with empty string', () => {
    const result = createVisitorId('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_VISITOR_ID');
    }
  });

  it('should fail with short string (< 8 chars)', () => {
    const result = createVisitorId('abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_VISITOR_ID');
    }
  });

  it('should return a VisitorId branded type', () => {
    const result = createVisitorId('v-abcdefgh');
    expect(result.success).toBe(true);
    if (result.success) {
      // Type guard: VisitorId assignable to string
      const _id: VisitorId = result.data;
      expect(typeof _id).toBe('string');
    }
  });
});

describe('createSessionId()', () => {
  it('should return a SessionId with sess- prefix', () => {
    const id = createSessionId();
    expect(id).toMatch(/^sess-/);
  });

  it('should return unique IDs on each call', () => {
    const id1 = createSessionId();
    const id2 = createSessionId();
    expect(id1).not.toBe(id2);
  });
});

describe('createMemoryId()', () => {
  it('should return a MemoryId with mem- prefix', () => {
    const id = createMemoryId();
    expect(id).toMatch(/^mem-/);
  });

  it('should return unique IDs on each call', () => {
    const id1 = createMemoryId();
    const id2 = createMemoryId();
    expect(id1).not.toBe(id2);
  });
});

describe('createRequestId()', () => {
  it('should return a RequestId with req- prefix', () => {
    const id = createRequestId();
    expect(id).toMatch(/^req-/);
  });
});

describe('generateConsentToken()', () => {
  it('should return a ConsentToken with ct- prefix', () => {
    const token = generateConsentToken();
    expect(token).toMatch(/^ct-/);
  });
});

describe('generateConfirmationId()', () => {
  it('should return a ConfirmationId with cfm- prefix', () => {
    const id = generateConfirmationId();
    expect(id).toMatch(/^cfm-/);
  });
});

describe('createAuditLogId()', () => {
  it('should return an AuditLogId with aud- prefix', () => {
    const id = createAuditLogId();
    expect(id).toMatch(/^aud-/);
  });
});
