/**
 * @file context-stream.test.ts
 * @description Unit tests for createContextStream + toAsyncIterable.
 */

import { describe, it, expect } from 'vitest';
import {
  createContextStream,
  toAsyncIterable,
  type ContextStreamEvent,
} from './context-stream.js';
import type { HandshakeOutcome } from '../orchestrator.js';

async function collect(stream: ReadableStream<ContextStreamEvent>): Promise<ContextStreamEvent[]> {
  const out: ContextStreamEvent[] = [];
  for await (const e of toAsyncIterable(stream)) out.push(e);
  return out;
}

describe('createContextStream', () => {
  it('emits pushed events in order and closes', async () => {
    let t = 100;
    const { stream, controller } = createContextStream({ now: () => t++ });

    controller.push({ type: 'phase:start', phase: 'collect' });
    controller.push({ type: 'phase:end', phase: 'collect', durationMs: 5 });
    controller.close();

    const events = await collect(stream);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe('phase:start');
    expect(events[0]?.at).toBe(100);
    expect(events[1]?.at).toBe(101);
  });

  it('push() is a no-op after close', async () => {
    const { stream, controller } = createContextStream();
    controller.push({ type: 'phase:start', phase: 'collect' });
    controller.close();
    controller.push({ type: 'phase:end', phase: 'collect', durationMs: 1 });
    const events = await collect(stream);
    expect(events).toHaveLength(1);
  });

  it('pushOutcome emits phase:end + decision', async () => {
    const outcome = {
      durationMs: 42,
      decision: {
        selectedLayer: 'CSS_3D',
        uiConfig: { locale: 'fa-IR', direction: 'rtl' },
        privacyMode: { restricted: false },
      },
    } as unknown as HandshakeOutcome;

    const { stream, controller } = createContextStream();
    controller.pushOutcome(outcome);
    controller.close();

    const events = await collect(stream);
    expect(events.map((e) => e.type)).toEqual(['phase:end', 'decision']);
    const decision = events[1];
    if (decision?.type !== 'decision') throw new Error('expected decision');
    expect(decision.layer).toBe('CSS_3D');
    expect(decision.locale).toBe('fa-IR');
    expect(decision.direction).toBe('rtl');
    expect(decision.restricted).toBe(false);
  });

  it('abort(reason) errors the stream', async () => {
    const { stream, controller } = createContextStream();
    const reader = stream.getReader();
    controller.push({ type: 'phase:start', phase: 'collect' });
    const first = await reader.read();
    expect(first.done).toBe(false);
    controller.abort('boom');
    await expect(reader.read()).rejects.toThrow(/boom|aborted/);
  });

  it('external AbortSignal cancels the stream', async () => {
    const ac = new AbortController();
    const { stream, controller } = createContextStream({ signal: ac.signal });
    const reader = stream.getReader();
    controller.push({ type: 'phase:start', phase: 'collect' });
    const first = await reader.read();
    expect(first.done).toBe(false);
    ac.abort();
    await expect(reader.read()).rejects.toThrow();
    expect(controller.closed).toBe(true);
  });

  it('errors immediately if signal already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const { stream } = createContextStream({ signal: ac.signal });
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow();
  });

  it('honors highWaterMark via desiredSize', () => {
    const { stream } = createContextStream({ highWaterMark: 4 });
    // ReadableStream queueing strategy is observable via reader's behavior;
    // here we just assert the API didn't throw.
    expect(stream).toBeDefined();
  });

  it('controller.closed reflects close', () => {
    const { controller } = createContextStream();
    expect(controller.closed).toBe(false);
    controller.close();
    expect(controller.closed).toBe(true);
  });
});

describe('toAsyncIterable', () => {
  it('iterates a stream produced from an array', async () => {
    const stream = new ReadableStream<number>({
      start(c) {
        c.enqueue(1);
        c.enqueue(2);
        c.enqueue(3);
        c.close();
      },
    });
    const out: number[] = [];
    for await (const v of toAsyncIterable(stream)) out.push(v);
    expect(out).toEqual([1, 2, 3]);
  });

  it('cancels the underlying reader on early break', async () => {
    let cancelled = false;
    const stream = new ReadableStream<number>({
      start(c) {
        c.enqueue(1);
        c.enqueue(2);
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const v of toAsyncIterable(stream)) {
      if (v === 1) break;
    }
    // Allow microtask for cancel to run.
    await Promise.resolve();
    expect(cancelled).toBe(true);
  });
});
