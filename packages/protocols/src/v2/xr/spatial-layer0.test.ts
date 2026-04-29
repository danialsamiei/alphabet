/**
 * @file spatial-layer0.test.ts
 * @description Tests for the in-memory Spatial Layer 0 adapter.
 */

import { describe, it, expect } from 'vitest';
import { createInMemorySpatialLayer0Adapter } from './spatial-layer0.js';
import type { XRSpatialAnchor } from './types.js';

const identityPose = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

function anchor(overrides: Partial<XRSpatialAnchor> = {}): XRSpatialAnchor {
  return {
    id: overrides.id ?? 'a-1',
    pose: overrides.pose ?? identityPose,
    scope: overrides.scope ?? 'local',
    requiredTier: overrides.requiredTier ?? 'CONSENTED',
    ...(overrides.label !== undefined ? { label: overrides.label } : {}),
    ...(overrides.metadata !== undefined ? { metadata: overrides.metadata } : {}),
  };
}

describe('in-memory SpatialLayer0Adapter', () => {
  it('attaches anchors when posture allows', async () => {
    const a = createInMemorySpatialLayer0Adapter();
    const r = await a.attach(anchor({ scope: 'local' }), 'on-device-only');
    expect(r.success).toBe(true);
    expect((await a.list()).length).toBe(1);
  });

  it('refuses world scope under on-device-only posture', async () => {
    const a = createInMemorySpatialLayer0Adapter();
    const r = await a.attach(anchor({ scope: 'world' }), 'on-device-only');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONSENT_INSUFFICIENT');
  });

  it('refuses NO_MEMORY tier anchors', async () => {
    const a = createInMemorySpatialLayer0Adapter();
    const r = await a.attach(anchor({ requiredTier: 'NO_MEMORY' }), 'session-ephemeral');
    expect(r.success).toBe(false);
  });

  it('allows world scope under session-ephemeral', async () => {
    const a = createInMemorySpatialLayer0Adapter();
    const r = await a.attach(anchor({ scope: 'world' }), 'session-ephemeral');
    expect(r.success).toBe(true);
  });

  it('revoke is idempotent', async () => {
    const a = createInMemorySpatialLayer0Adapter();
    const r1 = await a.revoke('does-not-exist');
    expect(r1.success).toBe(true);
    await a.attach(anchor({ id: 'gone' }), 'session-ephemeral');
    await a.revoke('gone');
    expect((await a.list()).length).toBe(0);
  });

  it('evicts oldest when maxAnchors exceeded', async () => {
    const a = createInMemorySpatialLayer0Adapter({ maxAnchors: 2 });
    await a.attach(anchor({ id: '1' }), 'session-ephemeral');
    await a.attach(anchor({ id: '2' }), 'session-ephemeral');
    await a.attach(anchor({ id: '3' }), 'session-ephemeral');
    const ids = (await a.list()).map((x) => x.id);
    expect(ids).toContain('3');
    expect(ids).not.toContain('1');
  });
});
