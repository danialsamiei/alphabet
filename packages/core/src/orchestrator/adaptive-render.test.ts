/**
 * @file adaptive-render.test.ts
 */

import { describe, it, expect } from 'vitest';
import { interpret, toMermaid } from './machine.js';
import { adaptiveRenderMachine } from './adaptive-render.js';

describe('adaptiveRenderMachine / detection flow', () => {
  it('starts in detecting', () => {
    const a = interpret(adaptiveRenderMachine).start();
    expect(a.getSnapshot().value).toBe('detecting');
  });

  it('detecting → resolving on DETECTED', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    expect(a.getSnapshot().value).toBe('resolving');
  });

  it('resolving → ready commits the layer', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'CSS_3D' });
    const s = a.getSnapshot();
    expect(s.value).toBe('ready');
    expect(s.context.current).toBe('CSS_3D');
    expect(s.context.target).toBe('CSS_3D');
  });
});

describe('adaptiveRenderMachine / degrade flow', () => {
  it('WARNING with a lower-tier suggestion enters degrading', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'R3F_IMMERSIVE' });
    a.send({ type: 'WARNING', kind: 'battery-low', suggested: 'CANVAS_2D' });
    const s = a.getSnapshot();
    expect(s.value).toBe('degrading');
    expect(s.context.lastWarning).toBe('battery-low');
    expect(s.context.target).toBe('CANVAS_2D');
  });

  it('WARNING with an equal-or-higher tier is ignored (guard)', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'CANVAS_2D' });
    a.send({ type: 'WARNING', kind: 'spurious', suggested: 'R3F_IMMERSIVE' });
    expect(a.getSnapshot().value).toBe('ready');
  });

  it('DEGRADE_DONE commits the target and increments transitionsCount', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'R3F_IMMERSIVE' });
    a.send({ type: 'WARNING', kind: 'battery-low', suggested: 'CANVAS_2D' });
    a.send({ type: 'DEGRADE_DONE' });
    const s = a.getSnapshot();
    expect(s.value).toBe('ready');
    expect(s.context.current).toBe('CANVAS_2D');
    expect(s.context.transitionsCount).toBe(1);
  });
});

describe('adaptiveRenderMachine / restore flow', () => {
  it('RESTORE with a higher-tier suggestion enters restoring', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'STATIC_HTML' });
    a.send({ type: 'RESTORE', suggested: 'CSS_3D' });
    const s = a.getSnapshot();
    expect(s.value).toBe('restoring');
    expect(s.context.target).toBe('CSS_3D');
  });

  it('RESTORE with a lower-tier suggestion is ignored', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'CSS_3D' });
    a.send({ type: 'RESTORE', suggested: 'STATIC_HTML' });
    expect(a.getSnapshot().value).toBe('ready');
  });

  it('RESTORE_DONE commits the target', () => {
    const a = interpret(adaptiveRenderMachine).start();
    a.send({ type: 'DETECTED' });
    a.send({ type: 'RESOLVED', layer: 'STATIC_HTML' });
    a.send({ type: 'RESTORE', suggested: 'CSS_3D' });
    a.send({ type: 'RESTORE_DONE' });
    const s = a.getSnapshot();
    expect(s.value).toBe('ready');
    expect(s.context.current).toBe('CSS_3D');
  });
});

describe('adaptiveRenderMachine / mermaid', () => {
  it('renders the five-state graph', () => {
    const out = toMermaid(adaptiveRenderMachine);
    expect(out).toContain('[*] --> detecting');
    expect(out).toContain('detecting --> resolving: DETECTED');
    expect(out).toContain('resolving --> ready: RESOLVED');
    expect(out).toContain('ready --> degrading: WARNING [isLowerTier]');
    expect(out).toContain('ready --> restoring: RESTORE [isHigherTier]');
  });
});
