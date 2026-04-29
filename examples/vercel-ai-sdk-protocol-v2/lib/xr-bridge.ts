/**
 * @file xr-bridge.ts
 * @description
 * Bridge that decides what shape of response the AlphabetAi route should
 * emit based on the visitor's current XR capabilities. The
 * `CrossRealityOrchestrator` tells us whether a richer payload is safe
 * to send; if not, the route falls back to plain text suitable for the
 * Vercel AI SDK's default `useChat` rendering.
 *
 * This file lives in the example app rather than the package because
 * it composes runtime concerns (request headers, response shape) that
 * are deployment-specific.
 */

import {
  CrossRealityOrchestrator,
  probeXrCapabilities,
  type XRRealityDecision,
  type XRCapabilitySnapshot,
} from '@alphabet/protocols/v2';
import type { ConsentTier } from '@alphabet/core';

/** Shape emitted to clients alongside the assistant text. */
export interface XrBridgeResult {
  readonly decision: XRRealityDecision;
  /** Hint to the client renderer about what to mount. */
  readonly recommendedRenderer: 'text' | 'static-html' | 'css-3d' | 'r3f' | 'webxr' | 'spatial';
  /**
   * True when the orchestrator found a privacy or consent reason to
   * downgrade the response. Clients should surface this in the
   * transparency panel.
   */
  readonly downgraded: boolean;
}

/**
 * Decide the response payload shape from a request's `x-alphabet-xr-*`
 * headers. The headers are optional — without them, the bridge returns
 * a `text` recommendation (the safest default).
 *
 * Headers consumed:
 *   • `x-alphabet-xr-snapshot`  — base64url-encoded JSON `XRCapabilitySnapshot`.
 *   • `x-alphabet-consent-tier` — visitor's current tier.
 *   • `x-alphabet-dnt`          — 'true' / 'false'.
 *   • `x-alphabet-gpc`          — 'true' / 'false'.
 *   • `x-alphabet-jurisdiction-restricts-xr` — 'true' / 'false'.
 */
export async function decideXrPayload(
  req: Request,
  orchestrator: CrossRealityOrchestrator = new CrossRealityOrchestrator(),
): Promise<XrBridgeResult> {
  const snapshot = await readSnapshot(req);
  const tier = readTier(req);
  const decision = orchestrator.decide({
    snapshot,
    consentTier: tier,
    privacy: {
      dntEnabled: req.headers.get('x-alphabet-dnt') === 'true',
      gpcEnabled: req.headers.get('x-alphabet-gpc') === 'true',
    },
  });
  return {
    decision,
    recommendedRenderer: mapToRenderer(decision),
    downgraded:
      decision.reasons.includes('consent-tier-too-low') ||
      decision.reasons.includes('privacy-signal-active') ||
      decision.reasons.includes('jurisdiction-restriction') ||
      decision.reasons.includes('reduced-motion'),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readSnapshot(req: Request): Promise<XRCapabilitySnapshot> {
  const raw = req.headers.get('x-alphabet-xr-snapshot');
  if (raw !== null && raw.length > 0) {
    try {
      const json = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as XRCapabilitySnapshot;
    } catch {
      /* fall through */
    }
  }
  // Without a client-supplied snapshot, fall back to a probe of the
  // request's environment. In edge runtimes this returns an absent
  // snapshot, which is the right default — the route will recommend
  // 'text' and the client can re-issue with a real snapshot.
  const r = await probeXrCapabilities();
  if (r.success) return r.data;
  return {
    webXrAvailable: false,
    immersiveVrSupported: false,
    immersiveArSupported: false,
    poseTrackingSupported: false,
    hitTestSupported: false,
    anchorsSupported: false,
    depthSensingSupported: false,
    handTrackingSupported: false,
    planeDetectionSupported: false,
    domOverlaySupported: false,
    ambientLightSupported: false,
    headsetClass: 'unknown',
    spatialLayer0Available: false,
    prefersReducedMotion: false,
  };
}

function readTier(req: Request): ConsentTier {
  const v = req.headers.get('x-alphabet-consent-tier');
  if (v === 'NO_MEMORY' || v === 'ANONYMOUS' || v === 'CONSENTED' || v === 'ENRICHED') {
    return v;
  }
  return 'ANONYMOUS';
}

function mapToRenderer(d: XRRealityDecision): XrBridgeResult['recommendedRenderer'] {
  switch (d.mode) {
    case 'spatial-layer-0':
      return 'spatial';
    case 'webxr-ar':
    case 'webxr-vr':
      return 'webxr';
    case 'r3f':
      return 'r3f';
    case 'css-3d':
      return 'css-3d';
    case 'flat':
      return d.fallbackLayer === 'TEXT_ONLY' ? 'text' : 'static-html';
    default: {
      const _exhaustive: never = d.mode;
      return _exhaustive;
    }
  }
}
