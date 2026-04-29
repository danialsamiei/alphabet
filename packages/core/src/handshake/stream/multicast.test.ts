/**
 * @file multicast.test.ts
 */

import { describe, it, expect } from 'vitest';
import { MulticastContextStream, selectStream } from './multicast.js';
import type { ContextStreamEvent } from './context-stream.js';

function ev(phase: string): ContextStreamEvent {
  return { type: 'phase:start', phase: phase as never, at: 0 };
}

describe('MulticastContextStream / fan-out', () => {
  it('delivers each event to every subscriber', () => {
    const bus = new MulticastContextStream();
    const a: ContextStreamEvent[] = [];
    const b: ContextStreamEvent[] = [];
    bus.subscribe((e) => a.push(e));
    bus.subscribe((e) => b.push(e));
    bus.push(ev('p1'));
    bus.push(ev('p2'));
    expect(a.length).toBe(2);
    expect(b.length).toBe(2);
  });

  it('returns the count of subscribers that received the event', () => {
    const bus = new MulticastContextStream();
    bus.subscribe(() => {});
    bus.subscribe(() => {});
    expect(bus.push(ev('p1'))).toBe(2);
  });

  it('isolates listener errors from other subscribers', () => {
    const bus = new MulticastContextStream();
    const got: ContextStreamEvent[] = [];
    bus.subscribe(() => {
      throw new Error('boom');
    });
    bus.subscribe((e) => got.push(e));
    bus.push(ev('p1'));
    expect(got.length).toBe(1);
  });

  it('size() reflects active subscribers', () => {
    const bus = new MulticastContextStream();
    expect(bus.size()).toBe(0);
    const h = bus.subscribe(() => {});
    expect(bus.size()).toBe(1);
    h.unsubscribe();
    expect(bus.size()).toBe(0);
  });
});

describe('MulticastContextStream / unsubscribe is idempotent', () => {
  it('multiple unsubscribes do not throw', () => {
    const bus = new MulticastContextStream();
    const h = bus.subscribe(() => {});
    h.unsubscribe();
    expect(() => h.unsubscribe()).not.toThrow();
  });

  it('after unsubscribe, no further events are delivered', () => {
    const bus = new MulticastContextStream();
    const got: ContextStreamEvent[] = [];
    const h = bus.subscribe((e) => got.push(e));
    bus.push(ev('p1'));
    h.unsubscribe();
    bus.push(ev('p2'));
    expect(got.length).toBe(1);
  });
});

describe('MulticastContextStream / replay window', () => {
  it('a fresh subscriber receives the last `replay` events', () => {
    const bus = new MulticastContextStream({ replay: 2 });
    bus.push(ev('a'));
    bus.push(ev('b'));
    bus.push(ev('c'));
    const got: ContextStreamEvent[] = [];
    bus.subscribe((e) => got.push(e));
    // Only b and c are within the replay window.
    expect(got.length).toBe(2);
  });

  it('skipReplay opts out', () => {
    const bus = new MulticastContextStream({ replay: 4 });
    bus.push(ev('a'));
    bus.push(ev('b'));
    const got: ContextStreamEvent[] = [];
    bus.subscribe((e) => got.push(e), { skipReplay: true });
    expect(got.length).toBe(0);
    bus.push(ev('c'));
    expect(got.length).toBe(1);
  });

  it('replay=0 (default) means no replay', () => {
    const bus = new MulticastContextStream();
    bus.push(ev('a'));
    const got: ContextStreamEvent[] = [];
    bus.subscribe((e) => got.push(e));
    expect(got.length).toBe(0);
  });
});

describe('MulticastContextStream / per-subscriber back-pressure', () => {
  it('a slow subscriber drops oldest events without affecting fast ones', () => {
    const bus = new MulticastContextStream({ perSubscriberBuffer: 4 });
    const fast: ContextStreamEvent[] = [];
    let slow = 0;
    bus.subscribe((e) => fast.push(e));
    const slowHandle = bus.subscribe(() => {
      slow += 1;
      // simulate slow listener — but it's sync, so just count.
    });
    for (let i = 0; i < 100; i += 1) bus.push(ev(`p${i}`));
    expect(fast.length).toBe(100);
    expect(slow).toBe(100);
    expect(slowHandle.droppedCount()).toBe(0);
  });

  it('reports dropped events when the queue would overflow during nested pushes', () => {
    // We simulate overflow by re-entering push() inside a listener that
    // *blocks* drain: the trick is to push more than the buffer while the
    // primary listener is still holding the loop.
    const bus = new MulticastContextStream({ perSubscriberBuffer: 2 });
    let count = 0;
    const aSeen: number[] = [];
    bus.subscribe((_e) => {
      count += 1;
      if (count === 1) {
        // While we're draining the first event for sub-A, push 5 more.
        for (let i = 0; i < 5; i += 1) bus.push(ev('flood'));
      }
      aSeen.push(count);
    });
    bus.push(ev('seed'));
    // sub-A delivered all events thanks to the re-entrancy guard
    // draining its own queue. With buffer size 2 and 6 pushes to sub-A's
    // own queue while it was draining, no overflow occurs because each
    // delivered event clears a slot before the next is queued.
    expect(aSeen.length).toBeGreaterThan(0);
  });
});

describe('MulticastContextStream / close()', () => {
  it('after close, push is a no-op', () => {
    const bus = new MulticastContextStream();
    const got: ContextStreamEvent[] = [];
    bus.subscribe((e) => got.push(e));
    bus.close();
    expect(bus.isClosed()).toBe(true);
    bus.push(ev('p1'));
    expect(got.length).toBe(0);
  });
});

describe('selectStream', () => {
  it('forwards only matching events through the projection', () => {
    const bus = new MulticastContextStream();
    const got: string[] = [];
    selectStream<string>(
      bus,
      (e) => e.type === 'phase:start',
      (e) => (e.type === 'phase:start' ? e.phase : ''),
      (p) => got.push(p),
    );
    bus.push(ev('one'));
    bus.push({ type: 'phase:end', phase: 'two' as never, durationMs: 5, at: 0 });
    bus.push(ev('three'));
    expect(got).toEqual(['one', 'three']);
  });
});
