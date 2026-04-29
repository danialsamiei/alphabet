/**
 * @file alphabet-events.test.ts
 * @description Unit tests for AlphabetEventEmitter.
 */

import { describe, it, expect, vi } from 'vitest';
import { AlphabetEventEmitter } from './alphabet-events.js';

describe('AlphabetEventEmitter', () => {
  describe('on() / emit()', () => {
    it('should call listener when event is emitted', () => {
      const emitter = new AlphabetEventEmitter();
      const listener = vi.fn();

      emitter.on('runtime:heartbeat', listener);
      emitter.emit('runtime:heartbeat', { timestamp: '2025-01-01T00:00:00Z' });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({ timestamp: '2025-01-01T00:00:00Z' });
    });

    it('should call multiple listeners for same event', () => {
      const emitter = new AlphabetEventEmitter();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on('runtime:heartbeat', listener1);
      emitter.on('runtime:heartbeat', listener2);
      emitter.emit('runtime:heartbeat', { timestamp: '2025-01-01T00:00:00Z' });

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('should not call listener for different event', () => {
      const emitter = new AlphabetEventEmitter();
      const listener = vi.fn();

      emitter.on('runtime:heartbeat', listener);
      emitter.emit('error', { code: 'ERR', message: 'error' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not throw when no listeners registered', () => {
      const emitter = new AlphabetEventEmitter();
      expect(() => {
        emitter.emit('runtime:heartbeat', { timestamp: 'now' });
      }).not.toThrow();
    });
  });

  describe('once()', () => {
    it('should call listener only once', () => {
      const emitter = new AlphabetEventEmitter();
      const listener = vi.fn();

      emitter.once('runtime:heartbeat', listener);
      emitter.emit('runtime:heartbeat', { timestamp: '1' });
      emitter.emit('runtime:heartbeat', { timestamp: '2' });

      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('off()', () => {
    it('should remove a registered listener', () => {
      const emitter = new AlphabetEventEmitter();
      const listener = vi.fn();

      emitter.on('runtime:heartbeat', listener);
      emitter.off('runtime:heartbeat', listener);
      emitter.emit('runtime:heartbeat', { timestamp: '1' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not throw when removing unregistered listener', () => {
      const emitter = new AlphabetEventEmitter();
      const listener = vi.fn();
      expect(() => emitter.off('runtime:heartbeat', listener)).not.toThrow();
    });
  });

  describe('priority', () => {
    it('should call listeners in descending priority order', () => {
      const emitter = new AlphabetEventEmitter();
      const order: number[] = [];

      emitter.on('runtime:heartbeat', () => order.push(1), 10);
      emitter.on('runtime:heartbeat', () => order.push(2), 100);
      emitter.on('runtime:heartbeat', () => order.push(3), 50);
      emitter.emit('runtime:heartbeat', { timestamp: 'now' });

      expect(order).toEqual([2, 3, 1]);
    });
  });

  describe('listenerCount()', () => {
    it('should return correct count of registered listeners', () => {
      const emitter = new AlphabetEventEmitter();
      expect(emitter.listenerCount('runtime:heartbeat')).toBe(0);

      const l1 = vi.fn();
      const l2 = vi.fn();
      emitter.on('runtime:heartbeat', l1);
      emitter.on('runtime:heartbeat', l2);

      expect(emitter.listenerCount('runtime:heartbeat')).toBe(2);
    });

    it('should decrease after off()', () => {
      const emitter = new AlphabetEventEmitter();
      const listener = vi.fn();
      emitter.on('runtime:heartbeat', listener);
      emitter.off('runtime:heartbeat', listener);
      expect(emitter.listenerCount('runtime:heartbeat')).toBe(0);
    });
  });

  describe('removeAllListeners()', () => {
    it('should remove all listeners for a specific event', () => {
      const emitter = new AlphabetEventEmitter();
      emitter.on('runtime:heartbeat', vi.fn());
      emitter.on('runtime:heartbeat', vi.fn());

      emitter.removeAllListeners('runtime:heartbeat');
      expect(emitter.listenerCount('runtime:heartbeat')).toBe(0);
    });

    it('should remove all listeners for all events when no argument', () => {
      const emitter = new AlphabetEventEmitter();
      emitter.on('runtime:heartbeat', vi.fn());
      emitter.on('error', vi.fn());

      emitter.removeAllListeners();
      expect(emitter.listenerCount('runtime:heartbeat')).toBe(0);
      expect(emitter.listenerCount('error')).toBe(0);
    });
  });

  describe('on() returns this for chaining', () => {
    it('should support method chaining', () => {
      const emitter = new AlphabetEventEmitter();
      const result = emitter.on('runtime:heartbeat', vi.fn());
      expect(result).toBe(emitter);
    });
  });
});
