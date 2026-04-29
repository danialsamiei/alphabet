/**
 * @file decision-machine.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  LAYER_TRANSITIONS,
  runLayerMachine,
  toLayerInput,
  toMermaid,
  assertNever,
  type LayerInput,
  type LayerState,
} from './index.js';
import { SignalCollector } from '../signal-collector.js';
import type { DetectedSignals } from '../../types/visitor.js';

function input(over: Partial<LayerInput> = {}): LayerInput {
  return {
    prefersReducedMotion: false,
    webglSupported: true,
    screenWidth: 1024,
    networkType: '4g',
    ...over,
  };
}

function signals(over: Partial<DetectedSignals> = {}): DetectedSignals {
  return {
    language: 'en',
    timezone: 'UTC',
    deviceClass: 'desktop',
    platform: 'Linux',
    screenWidth: 1024,
    screenHeight: 768,
    devicePixelRatio: 1,
    webglSupported: true,
    dntEnabled: false,
    gpcEnabled: false,
    prefersReducedMotion: false,
    referrer: '',
    ...over,
  };
}

describe('runLayerMachine', () => {
  it('routes prefers-reduced-motion to STATIC_HTML', () => {
    const r = runLayerMachine(input({ prefersReducedMotion: true }));
    expect(r.state).toBe('STATIC_HTML');
    expect(r.transition.id).toBe('rm-to-static');
  });

  it('routes !webgl to CANVAS_2D', () => {
    const r = runLayerMachine(input({ webglSupported: false }));
    expect(r.state).toBe('CANVAS_2D');
    expect(r.transition.id).toBe('no-webgl-to-canvas');
  });

  it('routes webgl + 4g + wide to R3F_IMMERSIVE', () => {
    const r = runLayerMachine(input({ networkType: '4g', screenWidth: 1440 }));
    expect(r.state).toBe('R3F_IMMERSIVE');
    expect(r.transition.id).toBe('webgl-4g-wide-to-r3f');
  });

  it('routes webgl + undefined network + wide to R3F (treats undefined as 4g)', () => {
    const r = runLayerMachine(input({ networkType: undefined, screenWidth: 1440 }));
    expect(r.state).toBe('R3F_IMMERSIVE');
  });

  it('routes webgl + 3g to CSS_3D', () => {
    const r = runLayerMachine(input({ networkType: '3g' }));
    expect(r.state).toBe('CSS_3D');
    expect(r.transition.id).toBe('webgl-3gplus-to-css3d');
  });

  it('routes webgl + 4g + narrow to CSS_3D', () => {
    const r = runLayerMachine(input({ networkType: '4g', screenWidth: 320 }));
    expect(r.state).toBe('CSS_3D');
  });

  it('routes webgl + 2g to CANVAS_2D fallback', () => {
    const r = runLayerMachine(input({ networkType: '2g' }));
    expect(r.state).toBe('CANVAS_2D');
    expect(r.transition.id).toBe('webgl-fallback-to-canvas');
  });

  it('routes webgl + slow-2g to CANVAS_2D', () => {
    const r = runLayerMachine(input({ networkType: 'slow-2g' }));
    expect(r.state).toBe('CANVAS_2D');
  });
});

describe('parity with SignalCollector.detectLayer', () => {
  const cases: Array<Partial<DetectedSignals>> = [
    { prefersReducedMotion: true },
    { webglSupported: false },
    { webglSupported: false, prefersReducedMotion: true }, // rm wins
    { webglSupported: true, networkType: '4g', screenWidth: 1024 },
    { webglSupported: true, networkType: '4g', screenWidth: 320 },
    { webglSupported: true, networkType: '3g' },
    { webglSupported: true, networkType: '2g' },
    { webglSupported: true, networkType: 'slow-2g' },
    { webglSupported: true, networkType: undefined, screenWidth: 1440 },
    { webglSupported: true, networkType: undefined, screenWidth: 480 },
  ];

  it.each(cases)('matches detectLayer for %o', (over) => {
    const s = signals(over);
    expect(runLayerMachine(toLayerInput(s)).state).toBe(SignalCollector.detectLayer(s));
  });
});

describe('LAYER_TRANSITIONS', () => {
  it('all transitions originate at START', () => {
    for (const t of LAYER_TRANSITIONS) expect(t.from).toBe('START');
  });

  it('every transition has a unique id', () => {
    const ids = LAYER_TRANSITIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('toMermaid', () => {
  it('produces a deterministic stateDiagram-v2 with one edge per transition', () => {
    const out = toMermaid();
    expect(out.startsWith('stateDiagram-v2')).toBe(true);
    const lines = out.split('\n').slice(1);
    expect(lines.length).toBe(LAYER_TRANSITIONS.length);
    expect(lines.every((l) => l.includes(' --> '))).toBe(true);
    // ریشه‌ها به [*] map شوند
    expect(lines.every((l) => l.trim().startsWith('[*] -->'))).toBe(true);
  });

  it('renders custom transition arrays', () => {
    const out = toMermaid([
      {
        id: 'a',
        label: 'always',
        from: 'START',
        to: 'STATIC_HTML',
        guard: () => true,
      },
    ]);
    expect(out).toBe('stateDiagram-v2\n  [*] --> STATIC_HTML : always');
  });

  it('sanitizes colons and newlines from labels', () => {
    const out = toMermaid([
      {
        id: 'b',
        label: 'cond: a:b\nc',
        from: 'START',
        to: 'CSS_3D',
        guard: () => true,
      },
    ]);
    expect(out).not.toContain(': cond: a:b\nc');
    expect(out).toContain('CSS_3D : cond  a b c');
  });
});

describe('assertNever', () => {
  it('throws for any value', () => {
    expect(() => assertNever('UNKNOWN' as never)).toThrow();
  });

  it('compiles in exhaustive switch', () => {
    function describe_(s: LayerState): string {
      switch (s) {
        case 'START': return 'start';
        case 'R3F_IMMERSIVE': return 'r3f';
        case 'CSS_3D': return 'css';
        case 'CANVAS_2D': return 'canvas';
        case 'STATIC_HTML': return 'static';
        case 'TEXT_ONLY': return 'text';
        default: return assertNever(s);
      }
    }
    expect(describe_('STATIC_HTML')).toBe('static');
  });
});
