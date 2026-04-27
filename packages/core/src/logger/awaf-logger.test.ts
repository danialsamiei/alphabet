/**
 * @file awaf-logger.test.ts
 * @description Unit tests for AWAFLogger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AWAFLogger, type LogEntry } from './awaf-logger.js';

describe('AWAFLogger', () => {
  describe('minLevel filtering', () => {
    it('should call sink for messages at or above minLevel', () => {
      const sink = vi.fn();
      const logger = new AWAFLogger({ minLevel: 'warn', sink, jsonOutput: false });

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      expect(sink).toHaveBeenCalledTimes(2);
      const calls = sink.mock.calls as [LogEntry][];
      expect(calls[0]?.[0]?.level).toBe('warn');
      expect(calls[1]?.[0]?.level).toBe('error');
    });

    it('should call sink for all messages when minLevel is debug', () => {
      const sink = vi.fn();
      const logger = new AWAFLogger({ minLevel: 'debug', sink });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(sink).toHaveBeenCalledTimes(4);
    });

    it('should call sink only for error when minLevel is error', () => {
      const sink = vi.fn();
      const logger = new AWAFLogger({ minLevel: 'error', sink });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(sink).toHaveBeenCalledTimes(1);
    });
  });

  describe('log entry structure', () => {
    it('should include timestamp, level, message in sink entry', () => {
      const entries: LogEntry[] = [];
      const logger = new AWAFLogger({
        minLevel: 'debug',
        sink: (e) => entries.push(e),
      });

      logger.info('test message', { key: 'value' });

      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(entry).toBeDefined();
      if (entry) {
        expect(entry.level).toBe('info');
        expect(entry.message).toBe('test message');
        expect(entry.context).toEqual({ key: 'value' });
        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('should include module name when provided', () => {
      const entries: LogEntry[] = [];
      const logger = new AWAFLogger({
        minLevel: 'debug',
        module: 'TestModule',
        sink: (e) => entries.push(e),
      });

      logger.debug('hello');

      const entry = entries[0];
      if (entry) {
        expect(entry.module).toBe('TestModule');
      }
    });
  });

  describe('child()', () => {
    it('should create child logger with new module name', () => {
      const entries: LogEntry[] = [];
      const parent = new AWAFLogger({
        minLevel: 'debug',
        sink: (e) => entries.push(e),
      });

      const child = parent.child('ChildModule');
      child.info('child message');

      const entry = entries[0];
      if (entry) {
        expect(entry.module).toBe('ChildModule');
        expect(entry.message).toBe('child message');
      }
    });
  });

  describe('defaults', () => {
    it('should default to minLevel info when not specified', () => {
      const sink = vi.fn();
      const logger = new AWAFLogger({ sink });

      logger.debug('debug');
      expect(sink).not.toHaveBeenCalled();

      logger.info('info');
      expect(sink).toHaveBeenCalledOnce();
    });
  });
});
