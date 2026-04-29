/**
 * @module @alphabet/protocols/v2/xr/capability-probe
 * @description
 * Pure feature detection for WebXR + Spatial Web Layer 0. The probe
 * never throws — it returns a `Result<XRCapabilitySnapshot, AlphabetProtocolError>`
 * that callers can pattern-match on.
 *
 * The probe is intentionally side-effect-free:
 *   • It only reads from the supplied `globalThis`-shaped object.
 *   • It never starts an XR session.
 *   • It never persists or transmits the result.
 *
 * Consumers that prefer to assemble their own snapshot (e.g. in a
 * server-rendered route) may bypass this helper entirely and pass a
 * literal `XRCapabilitySnapshot` to the orchestrator.
 */

import { ok, type Result } from '@alphabet/core';
import type { AlphabetProtocolError } from '../../errors/index.js';
import type { XRCapabilitySnapshot } from './types.js';

// ─── Minimal duck-typed shape of `navigator.xr` ─────────────────────────────

interface NavigatorXrLike {
  readonly xr?: {
    isSessionSupported?: (mode: string) => Promise<boolean>;
  };
  readonly userAgent?: string;
}

interface NavigatorWithBattery {
  getBattery?: () => Promise<{ readonly level?: number }>;
}

interface NavigatorWithConnection {
  readonly connection?: { readonly effectiveType?: string };
}

interface MatchMediaLike {
  matchMedia?: (query: string) => { readonly matches: boolean };
}

/** Options accepted by `probeXrCapabilities`. */
export interface ProbeXrCapabilitiesOptions {
  /** Override the global to probe against — useful for tests + SSR. */
  readonly host?: NavigatorXrLike & NavigatorWithBattery & NavigatorWithConnection & MatchMediaLike;
  /** Adapter availability hint — provided by the caller. */
  readonly spatialLayer0Available?: boolean;
}

/**
 * Resolve a `XRCapabilitySnapshot` for the current host. Returns
 * sensible "feature absent" defaults on any environment that lacks the
 * relevant globals (e.g. Node, edge runtimes). The function never
 * rejects — transport-level issues surface via the `Result.err` arm.
 *
 * @example
 * const result = await probeXrCapabilities();
 * if (result.success) console.log(result.data.immersiveArSupported);
 */
export async function probeXrCapabilities(
  options: ProbeXrCapabilitiesOptions = {},
): Promise<Result<XRCapabilitySnapshot, AlphabetProtocolError>> {
  const host =
    options.host ??
    (typeof globalThis !== 'undefined'
      ? (globalThis as unknown as NavigatorXrLike &
          NavigatorWithBattery &
          NavigatorWithConnection &
          MatchMediaLike)
      : undefined);
  const spatialLayer0Available = options.spatialLayer0Available ?? false;

  if (host === undefined) {
    return ok(buildAbsentSnapshot(spatialLayer0Available));
  }

  const xr = host.xr;
  let immersiveVrSupported = false;
  let immersiveArSupported = false;
  if (xr !== undefined && typeof xr.isSessionSupported === 'function') {
    [immersiveVrSupported, immersiveArSupported] = await Promise.all([
      safeCall(() => xr.isSessionSupported!('immersive-vr')),
      safeCall(() => xr.isSessionSupported!('immersive-ar')),
    ]);
  }

  const prefersReducedMotion = matchPrefersReducedMotion(host);
  const networkType = readNetworkType(host);
  const batteryLevel = await readBatteryLevel(host);
  const headsetClass = inferHeadsetClass(host.userAgent ?? '', {
    immersiveVrSupported,
    immersiveArSupported,
  });

  const snapshot: XRCapabilitySnapshot = {
    webXrAvailable: xr !== undefined,
    immersiveVrSupported,
    immersiveArSupported,
    poseTrackingSupported: immersiveVrSupported || immersiveArSupported,
    hitTestSupported: immersiveArSupported,
    anchorsSupported: immersiveVrSupported || immersiveArSupported,
    depthSensingSupported: false,
    handTrackingSupported: false,
    planeDetectionSupported: immersiveArSupported,
    domOverlaySupported: immersiveArSupported,
    ambientLightSupported: false,
    headsetClass,
    spatialLayer0Available,
    prefersReducedMotion,
    ...(batteryLevel !== undefined ? { batteryLevel } : {}),
    ...(networkType !== undefined ? { networkType } : {}),
  };
  return ok(snapshot);
}

/** Build a snapshot for environments where no host is available. */
function buildAbsentSnapshot(spatialLayer0Available: boolean): XRCapabilitySnapshot {
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
    spatialLayer0Available,
    prefersReducedMotion: false,
  };
}

async function safeCall(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch {
    return false;
  }
}

function matchPrefersReducedMotion(host: MatchMediaLike): boolean {
  if (typeof host.matchMedia !== 'function') return false;
  try {
    return host.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function readNetworkType(
  host: NavigatorWithConnection,
): XRCapabilitySnapshot['networkType'] | undefined {
  const t = host.connection?.effectiveType;
  if (t === '4g' || t === '3g' || t === '2g' || t === 'slow-2g') return t;
  return undefined;
}

async function readBatteryLevel(host: NavigatorWithBattery): Promise<number | undefined> {
  if (typeof host.getBattery !== 'function') return undefined;
  try {
    const b = await host.getBattery();
    return typeof b?.level === 'number' ? b.level : undefined;
  } catch {
    return undefined;
  }
}

function inferHeadsetClass(
  userAgent: string,
  flags: { readonly immersiveVrSupported: boolean; readonly immersiveArSupported: boolean },
): XRCapabilitySnapshot['headsetClass'] {
  const ua = userAgent.toLowerCase();
  if (ua.includes('oculus') || ua.includes('quest')) return 'standalone-vr';
  if (ua.includes('vision') || ua.includes('visionos')) return 'passthrough-ar';
  if (ua.includes('pico') || ua.includes('vive')) return 'tethered-vr';
  if (flags.immersiveArSupported) return 'mobile-ar';
  if (flags.immersiveVrSupported) return 'tethered-vr';
  return 'unknown';
}
