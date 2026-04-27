/**
 * @file redactor.test.ts
 * @description Unit tests for PII redaction utilities.
 */

import { describe, it, expect } from 'vitest';
import { detectPII, redactPII, redactPIIDeep } from './redactor.js';

describe('detectPII — emails', () => {
  it('detects a single email at standard strictness', () => {
    const findings = detectPII('contact alice@example.com today');
    expect(findings).toHaveLength(1);
    const first = findings[0];
    expect(first?.kind).toBe('email');
    expect(first?.preview).toBe('a***@example.com');
  });

  it('detects multiple emails and returns them in order', () => {
    const findings = detectPII('a@x.io and b@y.dev');
    expect(findings.map((f) => f.kind)).toEqual(['email', 'email']);
    expect((findings[0]?.start ?? -1) < (findings[1]?.start ?? -1)).toBe(true);
  });
});

describe('detectPII — phones', () => {
  it('detects an international phone number at standard strictness', () => {
    const findings = detectPII('call +1 415-555-0199 now');
    expect(findings.some((f) => f.kind === 'phone')).toBe(true);
  });

  it('does not flag short numeric runs as phones', () => {
    const findings = detectPII('build 12345');
    expect(findings.some((f) => f.kind === 'phone')).toBe(false);
  });

  it('does not flag phones at lenient strictness', () => {
    const findings = detectPII('call +1 415-555-0199', { strictness: 'lenient' });
    expect(findings.some((f) => f.kind === 'phone')).toBe(false);
  });
});

describe('detectPII — tokens and access keys', () => {
  it('detects AWS access key id', () => {
    const findings = detectPII('AKIAIOSFODNN7EXAMPLE in env');
    expect(findings.some((f) => f.kind === 'aws_access_key')).toBe(true);
  });

  it('detects Google API key', () => {
    const findings = detectPII('key=AIzaSyA-1234567890abcdefghijklmnopqrstu');
    expect(findings.some((f) => f.kind === 'google_api_key')).toBe(true);
  });

  it('detects GitHub PAT', () => {
    const findings = detectPII('export GH=ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    expect(findings.some((f) => f.kind === 'github_token')).toBe(true);
  });

  it('detects JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const findings = detectPII(`auth ${jwt}`);
    expect(findings.some((f) => f.kind === 'jwt')).toBe(true);
  });

  it('detects PEM private key blocks', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOQIB...\n-----END RSA PRIVATE KEY-----';
    const findings = detectPII(pem);
    expect(findings.some((f) => f.kind === 'private_key_block')).toBe(true);
  });
});

describe('detectPII — strictness levels', () => {
  it('lenient does not flag phone or credit card', () => {
    const findings = detectPII('call +1 415-555-0199 card 4242 4242 4242 4242', {
      strictness: 'lenient',
    });
    expect(findings.some((f) => f.kind === 'phone')).toBe(false);
    expect(findings.some((f) => f.kind === 'credit_card')).toBe(false);
  });

  it('strict flags ipv4 and high-entropy secrets', () => {
    const findings = detectPII('host 192.168.1.1 token aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', {
      strictness: 'strict',
    });
    expect(findings.some((f) => f.kind === 'ipv4')).toBe(true);
  });
});

describe('redactPII', () => {
  it('replaces detected PII and preserves surrounding text', () => {
    const { redacted, findings } = redactPII('email alice@example.com please');
    expect(redacted).toBe('email [REDACTED:email] please');
    expect(findings).toHaveLength(1);
  });

  it('honours custom replacer without leaking raw values', () => {
    const { redacted } = redactPII('email alice@example.com', {
      replacer: (kind) => `<${kind.toUpperCase()}>`,
    });
    expect(redacted).toBe('email <EMAIL>');
  });

  it('returns input unchanged when no PII is found', () => {
    const { redacted, findings } = redactPII('hello world');
    expect(redacted).toBe('hello world');
    expect(findings).toHaveLength(0);
  });

  it('handles multiple findings in document order', () => {
    const { redacted } = redactPII('a@x.io and b@y.dev', { strictness: 'lenient' });
    expect(redacted).toBe('[REDACTED:email] and [REDACTED:email]');
  });

  it('does not include the raw value in any returned preview', () => {
    const { findings } = redactPII('email alice@example.com');
    for (const f of findings) {
      expect(f.preview.includes('alice@example.com')).toBe(false);
    }
  });
});

describe('redactPIIDeep', () => {
  it('redacts string leaves in nested objects', () => {
    const input = {
      user: { email: 'alice@example.com', name: 'A' },
      meta: ['hello', 'token=ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
    };
    const { value, findings } = redactPIIDeep(input);
    expect((value.user as { email: string }).email).toBe('[REDACTED:email]');
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it('handles cyclic objects without infinite loops', () => {
    interface Node {
      label: string;
      self?: Node;
    }
    const node: Node = { label: 'alice@example.com' };
    node.self = node;
    const { value } = redactPIIDeep(node);
    expect(value.label).toBe('[REDACTED:email]');
  });
});
