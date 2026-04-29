/**
 * @file machine.test.ts
 */

import { describe, it, expect } from 'vitest';
import { createMachine, interpret, toMermaid } from './machine.js';

interface Ctx {
  count: number;
}
type Ev = { type: 'INC' } | { type: 'RESET' } | { type: 'NOOP' };

const counter = createMachine<Ctx, Ev>({
  id: 'counter',
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      on: {
        INC: { target: 'idle', actions: ['bump'] },
        RESET: { target: 'idle', guard: 'isPositive', actions: ['zero'] },
      },
    },
  },
  guards: {
    isPositive: (ctx) => ctx.count > 0,
  },
  actions: {
    bump: (ctx) => ({ count: ctx.count + 1 }),
    zero: () => ({ count: 0 }),
  },
});

describe('createMachine validation', () => {
  it('throws on unknown initial state', () => {
    expect(() =>
      createMachine({
        id: 'bad',
        initial: 'nope',
        context: {},
        states: { ok: {} },
      } as never),
    ).toThrow(/initial state 'nope'/);
  });

  it('throws on transition to unknown target', () => {
    expect(() =>
      createMachine({
        id: 'bad',
        initial: 'a',
        context: {},
        states: { a: { on: { GO: { target: 'b' } } } },
      } as never),
    ).toThrow(/targets unknown state 'b'/);
  });

  it('throws on unregistered guard', () => {
    expect(() =>
      createMachine({
        id: 'bad',
        initial: 'a',
        context: {},
        states: { a: { on: { GO: { target: 'a', guard: 'missing' } } } },
      } as never),
    ).toThrow(/guard 'missing'/);
  });

  it('throws on unregistered action', () => {
    expect(() =>
      createMachine({
        id: 'bad',
        initial: 'a',
        context: {},
        states: { a: { on: { GO: { target: 'a', actions: ['missing'] } } } },
      } as never),
    ).toThrow(/action 'missing'/);
  });
});

describe('interpret / lifecycle', () => {
  it('emits the initial snapshot on subscribe', () => {
    const a = interpret(counter).start();
    let seen: number | undefined;
    a.subscribe((s) => {
      seen = s.context.count;
    });
    expect(seen).toBe(0);
  });

  it('actions update context immutably', () => {
    const a = interpret(counter).start();
    a.send({ type: 'INC' });
    a.send({ type: 'INC' });
    expect(a.getSnapshot().context.count).toBe(2);
  });

  it('guards block transitions when they return false', () => {
    const a = interpret(counter).start();
    // RESET guarded by isPositive — at count=0 it should be blocked.
    a.send({ type: 'RESET' });
    expect(a.getSnapshot().context.count).toBe(0);
    a.send({ type: 'INC' });
    a.send({ type: 'RESET' });
    expect(a.getSnapshot().context.count).toBe(0);
  });

  it('unknown event types are no-ops', () => {
    const a = interpret(counter).start();
    a.send({ type: 'NOOP' });
    expect(a.getSnapshot().context.count).toBe(0);
  });

  it('events before start() are ignored', () => {
    const a = interpret(counter);
    a.send({ type: 'INC' });
    expect(a.getSnapshot().context.count).toBe(0);
  });

  it('events after stop() are ignored', () => {
    const a = interpret(counter).start();
    a.stop();
    a.send({ type: 'INC' });
    expect(a.getSnapshot().context.count).toBe(0);
  });

  it('subscribe returns an idempotent unsubscribe', () => {
    const a = interpret(counter).start();
    let calls = 0;
    const sub = a.subscribe(() => {
      calls += 1;
    });
    a.send({ type: 'INC' });
    sub.unsubscribe();
    sub.unsubscribe(); // idempotent
    a.send({ type: 'INC' });
    // initial + one INC = 2; second INC was after unsub.
    expect(calls).toBe(2);
  });
});

describe('toMermaid', () => {
  it('produces a stateDiagram-v2 with the initial transition', () => {
    const out = toMermaid(counter);
    expect(out).toContain('stateDiagram-v2');
    expect(out).toContain('[*] --> idle');
    expect(out).toContain('idle --> idle: INC');
    expect(out).toContain('idle --> idle: RESET [isPositive]');
  });
});
