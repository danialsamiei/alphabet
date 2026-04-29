/**
 * @file layer.test.ts
 * @description Tests for the `Layer<R>` DI container.
 */

import { describe, it, expect } from 'vitest';
import { layerSucceed, layerSync, layerMerge } from './layer.js';

describe('Layer', () => {
  it('layerSucceed returns the static services', () => {
    const l = layerSucceed({ now: () => 42 });
    expect(l.build().now()).toBe(42);
  });

  it('layerSync builds lazily and caches', () => {
    let calls = 0;
    const l = layerSync(() => {
      calls += 1;
      return { v: 'X' };
    });
    expect(calls).toBe(0);
    l.build();
    l.build();
    expect(calls).toBe(1);
  });

  it('layerMerge combines services with right-side overrides', () => {
    const a = layerSucceed({ a: 1, shared: 'A' });
    const b = layerSucceed({ b: 2, shared: 'B' });
    const merged = layerMerge(a, b);
    expect(merged.build()).toEqual({ a: 1, b: 2, shared: 'B' });
  });
});
