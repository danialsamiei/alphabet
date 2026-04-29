/**
 * @file compression.test.ts
 * @description Tests for AwafProtocol v2 context compression strategies.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessagesTokens,
  compressByPriority,
  compressBySlidingWindow,
  compressBySemanticDedupe,
  compose,
  DEFAULT_COMPRESSION,
} from './index.js';
import type { AwafChatMessage } from '../types.js';

const m = (
  role: AwafChatMessage['role'],
  content: string,
  priority?: number,
): AwafChatMessage =>
  priority === undefined ? { role, content } : { role, content, priority };

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
  it('uses ~4 chars per token for ASCII', () => {
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
  it('inflates non-ASCII by 1.5x', () => {
    const ascii = estimateTokens('a'.repeat(40));
    const fa = estimateTokens('پ'.repeat(40));
    expect(fa).toBeGreaterThan(ascii);
  });
  it('estimateMessagesTokens sums content + overhead', () => {
    const msgs = [m('user', 'hello'), m('assistant', 'world')];
    expect(estimateMessagesTokens(msgs)).toBeGreaterThan(0);
  });
});

describe('compressByPriority', () => {
  it('returns input copy when within budget', () => {
    const msgs = [m('user', 'hi')];
    const out = compressByPriority(msgs, 1000);
    expect(out).toEqual(msgs);
    expect(out).not.toBe(msgs);
  });
  it('drops lowest priority first', () => {
    const msgs = [
      m('system', 'sys'),
      m('user', 'a'.repeat(100), 0),
      m('user', 'b'.repeat(100), 5),
      m('user', 'c'.repeat(100), 10),
    ];
    const out = compressByPriority(msgs, 60);
    // System always pinned; among remaining, highest priority first.
    expect(out[0]?.role).toBe('system');
    expect(out.some((x) => x.content.startsWith('c'))).toBe(true);
    expect(out.some((x) => x.content.startsWith('a'))).toBe(false);
  });
  it('always keeps system messages', () => {
    const msgs = [m('system', 's'.repeat(40)), m('user', 'u'.repeat(400))];
    const out = compressByPriority(msgs, 5);
    expect(out.some((x) => x.role === 'system')).toBe(true);
  });
});

describe('compressBySlidingWindow', () => {
  it('keeps last N non-system + all system', () => {
    const msgs = [
      m('system', 'sys'),
      m('user', '1'),
      m('user', '2'),
      m('user', '3'),
      m('user', '4'),
    ];
    const window = compressBySlidingWindow(2);
    const out = window(msgs, 0);
    expect(out.length).toBe(3);
    expect(out[0]?.role).toBe('system');
    expect(out[1]?.content).toBe('3');
    expect(out[2]?.content).toBe('4');
  });
});

describe('compressBySemanticDedupe', () => {
  it('drops duplicate user turns by hash', () => {
    const msgs = [
      m('user', 'Hello world'),
      m('assistant', 'hi'),
      m('user', 'hello world'),
      m('user', 'something else'),
    ];
    const out = compressBySemanticDedupe(msgs);
    expect(out.length).toBe(3);
    expect(out.filter((x) => x.role === 'user' && x.content.toLowerCase() === 'hello world').length).toBe(1);
  });
});

describe('compose', () => {
  it('stops once the budget is satisfied', () => {
    const msgs = [
      m('system', 'sys'),
      m('user', 'a'.repeat(100)),
      m('user', 'b'.repeat(100)),
    ];
    const r = compose(DEFAULT_COMPRESSION, msgs, 1000);
    expect(r.tokens).toBeLessThanOrEqual(1000);
  });
  it('honours a tight budget by dropping messages', () => {
    const msgs = [
      m('system', 'sys'),
      m('user', 'a'.repeat(400), 0),
      m('user', 'b'.repeat(20), 9),
    ];
    const r = compose(DEFAULT_COMPRESSION, msgs, 30);
    expect(r.messages.length).toBeLessThan(msgs.length);
  });
});
