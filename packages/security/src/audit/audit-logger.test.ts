/**
 * @file audit-logger.test.ts
 * @description Tests for AlphabetAuditLogger — sink wiring, PII redaction by
 * default, and per-category event shape.
 */

import { describe, it, expect, vi } from 'vitest';
import { AlphabetAuditLogger, InMemoryAuditSink } from './audit-logger.js';

describe('AlphabetAuditLogger — sink wiring', () => {
  it('forwards events to the configured sink', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    logger.consentChanged({
      previousState: 'pending',
      nextState: 'granted',
      previousTier: 'NO_MEMORY',
      nextTier: 'CONSENTED',
      reason: 'banner_click',
    });
    expect(sink.snapshot()).toHaveLength(1);
    expect(sink.snapshot()[0]?.category).toBe('consent_changed');
    expect(sink.snapshot()[0]?.severity).toBe('info');
  });

  it('does not throw when the sink throws', () => {
    const logger = new AlphabetAuditLogger({
      sink: () => {
        throw new Error('boom');
      },
    });
    expect(() =>
      logger.privacySignalDetected({
        dntEnabled: true,
        gpcEnabled: false,
        downgradedTo: 'NO_MEMORY',
      })
    ).not.toThrow();
  });

  it('uses defaultCorrelationId when none is supplied', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write, defaultCorrelationId: 'req-1' });
    logger.policyVersionChanged({
      previousVersion: '2025-01-01',
      nextVersion: '2025-04-01',
      invalidatedConsents: 3,
    });
    expect(sink.snapshot()[0]?.correlationId).toBe('req-1');
  });

  it('lets explicit correlationId override the default', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write, defaultCorrelationId: 'default-id' });
    logger.consentChanged(
      {
        previousState: 'pending',
        nextState: 'granted',
        previousTier: 'NO_MEMORY',
        nextTier: 'ANONYMOUS',
      },
      'explicit-id'
    );
    expect(sink.snapshot()[0]?.correlationId).toBe('explicit-id');
  });
});

describe('AlphabetAuditLogger — PII redaction', () => {
  it('redacts emails in event data by default', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    logger.outputRejected({
      kind: 'html',
      errorCode: 'CONTAINS_PII',
      reason: 'email alice@example.com leaked',
      redacted: 'placeholder',
    });
    const ev = sink.snapshot()[0];
    if (ev?.category === 'output_rejected') {
      expect(ev.data.reason).not.toContain('alice@example.com');
      expect(ev.data.reason).toContain('[REDACTED:email]');
    }
  });

  it('does not redact when redactPII=false', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write, redactPII: false });
    logger.outputRejected({
      kind: 'html',
      errorCode: 'CONTAINS_PII',
      reason: 'email alice@example.com',
      redacted: 'placeholder',
    });
    const ev = sink.snapshot()[0];
    if (ev?.category === 'output_rejected') {
      expect(ev.data.reason).toContain('alice@example.com');
    }
  });
});

describe('AlphabetAuditLogger — severity by category', () => {
  it('emits prompt_risk_detected with severity matching the level', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    logger.promptRiskDetected({ level: 'high', score: 0.9, action: 'block', patterns: ['ignore_previous'] });
    logger.promptRiskDetected({ level: 'low', score: 0.0, action: 'allow', patterns: [] });
    const events = sink.snapshot();
    expect(events[0]?.severity).toBe('critical');
    expect(events[1]?.severity).toBe('info');
  });

  it('emits memory_write_blocked with severity warning', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    logger.memoryWriteBlocked({
      domain: 'visitor',
      consentTier: 'NO_MEMORY',
      errorCode: 'MEMORY_WRITE_BLOCKED_NO_CONSENT',
      reason: 'no consent',
    });
    expect(sink.snapshot()[0]?.severity).toBe('warning');
  });
});

describe('InMemoryAuditSink', () => {
  it('respects the bufferLimit option', () => {
    const sink = new InMemoryAuditSink({ bufferLimit: 2 });
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    for (let i = 0; i < 5; i += 1) {
      logger.consentChanged({
        previousState: 'pending',
        nextState: 'granted',
        previousTier: 'NO_MEMORY',
        nextTier: 'ANONYMOUS',
        reason: `evt-${i}`,
      });
    }
    expect(sink.snapshot()).toHaveLength(2);
  });

  it('byCategory filters correctly', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    logger.consentChanged({
      previousState: 'pending',
      nextState: 'granted',
      previousTier: 'NO_MEMORY',
      nextTier: 'ANONYMOUS',
    });
    logger.privacySignalDetected({ dntEnabled: true, gpcEnabled: false, downgradedTo: 'NO_MEMORY' });
    expect(sink.byCategory('consent_changed')).toHaveLength(1);
    expect(sink.byCategory('privacy_signal_detected')).toHaveLength(1);
    expect(sink.byCategory('output_rejected')).toHaveLength(0);
  });

  it('clear() empties the buffer', () => {
    const sink = new InMemoryAuditSink();
    const logger = new AlphabetAuditLogger({ sink: sink.write });
    logger.consentChanged({
      previousState: 'pending',
      nextState: 'granted',
      previousTier: 'NO_MEMORY',
      nextTier: 'ANONYMOUS',
    });
    sink.clear();
    expect(sink.snapshot()).toHaveLength(0);
  });
});

describe('AlphabetAuditLogger — function sinks', () => {
  it('accepts a plain function sink', () => {
    const fn = vi.fn();
    const logger = new AlphabetAuditLogger({ sink: fn });
    logger.consentChanged({
      previousState: 'pending',
      nextState: 'granted',
      previousTier: 'NO_MEMORY',
      nextTier: 'ANONYMOUS',
    });
    expect(fn).toHaveBeenCalledOnce();
  });
});
