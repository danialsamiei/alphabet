/**
 * @module @alphabet/protocols/v2/xr/types
 * @description
 * Public types for the AlphabetProtocol v2 Cross-Reality Orchestrator.
 *
 * The XR layer treats WebXR (VR/AR) and Spatial Web Layer 0 as a tier
 * *above* the existing capability ladder
 * (`R3F_IMMERSIVE → CSS_3D → CANVAS_2D → STATIC_HTML → TEXT_ONLY`).
 * Every XR mode degrades gracefully into one of the existing
 * `CapabilityLayer` values when a session cannot be entered.
 *
 * Privacy posture (the `XRPrivacyPosture`) is part of every decision so
 * downstream consumers can audit whether spatial telemetry (poses,
 * anchors, depth) leaves the device.
 */

import type { CapabilityLayer, ConsentTier } from '@alphabet/core';

// ─── Mode + posture ──────────────────────────────────────────────────────────

/**
 * Reality modes the orchestrator can choose. Ordered roughly from
 * leanest (`flat`) to richest (`spatial-layer-0`).
 */
export type XRRealityMode =
  | 'flat'
  | 'css-3d'
  | 'r3f'
  | 'webxr-vr'
  | 'webxr-ar'
  | 'spatial-layer-0';

/**
 * Privacy posture applied to a chosen XR mode.
 *
 *   • `on-device-only` — pose, anchors, depth, and gaze stay on the
 *     device. Default for every mode at consent tier 0–1.
 *   • `session-ephemeral` — anchors persist for the active session and
 *     are discarded on tab close. Default for tier 2.
 *   • `persistent-with-proof` — anchors may be persisted across
 *     sessions but only when a verified ECDSA consent proof is bound to
 *     the orchestrator. Default ceiling for tier 3.
 */
export type XRPrivacyPosture =
  | 'on-device-only'
  | 'session-ephemeral'
  | 'persistent-with-proof';

// ─── Capability snapshot ─────────────────────────────────────────────────────

/**
 * Snapshot of what the runtime reports about XR support. Pure data —
 * the orchestrator never inspects globals on its own; consumers
 * provide a snapshot via `capability-probe.ts` or their own logic.
 */
export interface XRCapabilitySnapshot {
  /** True when `navigator.xr` exists. */
  readonly webXrAvailable: boolean;
  /** Whether `immersive-vr` sessions are supported. */
  readonly immersiveVrSupported: boolean;
  /** Whether `immersive-ar` sessions are supported. */
  readonly immersiveArSupported: boolean;
  /** Whether the device exposes 6DoF pose tracking. */
  readonly poseTrackingSupported: boolean;
  /** Whether hit-test (AR placement) is available. */
  readonly hitTestSupported: boolean;
  /** Whether the WebXR Anchors module is available. */
  readonly anchorsSupported: boolean;
  /** Whether depth-sensing is available. */
  readonly depthSensingSupported: boolean;
  /** Whether hand-tracking is available. */
  readonly handTrackingSupported: boolean;
  /** Whether plane-detection is available. */
  readonly planeDetectionSupported: boolean;
  /** Whether DOM-overlay (HTML over XR) is available. */
  readonly domOverlaySupported: boolean;
  /** Whether ambient-light estimation is available. */
  readonly ambientLightSupported: boolean;
  /** Coarse headset class — `unknown` when unidentified. */
  readonly headsetClass:
    | 'unknown'
    | 'mobile-ar'
    | 'standalone-vr'
    | 'tethered-vr'
    | 'passthrough-ar';
  /** Whether a Spatial Web Layer 0 adapter is bound + reachable. */
  readonly spatialLayer0Available: boolean;
  /** True when the user prefers reduced motion. */
  readonly prefersReducedMotion: boolean;
  /** Battery level in [0, 1] when known. */
  readonly batteryLevel?: number;
  /** Network class hint. */
  readonly networkType?: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
}

// ─── Spatial Web Layer 0 anchor ──────────────────────────────────────────────

/**
 * Minimal Spatial Web Layer 0 anchor shape — modelled after the
 * IEEE P2874 "Spatial Domain" terminology. Adapters may carry richer
 * payloads in their own wire format; `XRSpatialAnchor` is what the
 * orchestrator stores in memory.
 */
export interface XRSpatialAnchor {
  /** Stable anchor id (caller-provided, no PII). */
  readonly id: string;
  /** Optional human label — never PII. */
  readonly label?: string;
  /**
   * 4×4 column-major pose matrix. The orchestrator does not interpret
   * the matrix; it only persists / discards according to the active
   * privacy posture.
   */
  readonly pose: readonly number[];
  /**
   * Anchor scope — `local` lives in the current session only, `world`
   * is allowed to persist when the privacy posture permits it.
   */
  readonly scope: 'local' | 'world';
  /** Tier required to attach this anchor. */
  readonly requiredTier: ConsentTier;
  /** Optional metadata — keep small and PII-free. */
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

// ─── Decision + hints ────────────────────────────────────────────────────────

/**
 * Reason the orchestrator selected the chosen mode (or downgraded
 * away from a richer one). Reasons are stable strings so callers may
 * surface them in a transparency UI.
 */
export type XRDecisionReason =
  | 'no-webxr'
  | 'no-immersive-session'
  | 'reduced-motion'
  | 'battery-low'
  | 'network-poor'
  | 'consent-tier-too-low'
  | 'privacy-signal-active'
  | 'jurisdiction-restriction'
  | 'spatial-layer0-unavailable'
  | 'fallback-to-capability-layer'
  | 'capability-allowed';

/**
 * Result of `CrossRealityOrchestrator.decide()`. Always includes the
 * `fallbackLayer` — the `CapabilityLayer` that the existing UI runtime
 * should render when the chosen XR mode cannot be entered.
 */
export interface XRRealityDecision {
  readonly mode: XRRealityMode;
  readonly fallbackLayer: CapabilityLayer;
  readonly privacyPosture: XRPrivacyPosture;
  readonly reasons: readonly XRDecisionReason[];
}

/**
 * Actionable hint emitted by `CrossRealityOrchestrator.forecast()`.
 * Mirrors the shape of `LayerForecastHint` in `pulse/index.ts` so
 * runtime code can fan multiple hint sources into one queue.
 */
export type XRRealityHint =
  | {
      readonly kind: 'enter-xr';
      readonly mode: 'webxr-vr' | 'webxr-ar' | 'spatial-layer-0';
      readonly reason: XRDecisionReason;
      readonly urgency: 'low' | 'medium';
    }
  | {
      readonly kind: 'exit-xr';
      readonly to: CapabilityLayer;
      readonly reason: XRDecisionReason;
      readonly urgency: 'medium' | 'high';
    }
  | {
      readonly kind: 'consent-required';
      readonly forMode: Exclude<XRRealityMode, 'flat' | 'css-3d' | 'r3f'>;
      readonly minimumTier: ConsentTier;
    }
  | {
      readonly kind: 'no-change';
      readonly currentMode: XRRealityMode;
    };

// ─── Event channel ───────────────────────────────────────────────────────────

/**
 * Event names emitted by `CrossRealityOrchestrator`. Payload types are
 * declared in the matching `XROrchestratorEventMap`.
 */
export type XROrchestratorEventName =
  | 'reality:upgrade'
  | 'reality:downgrade'
  | 'reality:anchor-added'
  | 'reality:anchor-revoked'
  | 'reality:consent-required';

/** Payload map for `XROrchestratorEventName`. */
export interface XROrchestratorEventMap {
  'reality:upgrade': { readonly from: XRRealityMode; readonly to: XRRealityMode };
  'reality:downgrade': {
    readonly from: XRRealityMode;
    readonly to: XRRealityMode;
    readonly reasons: readonly XRDecisionReason[];
  };
  'reality:anchor-added': { readonly anchorId: string; readonly scope: 'local' | 'world' };
  'reality:anchor-revoked': {
    readonly anchorId: string;
    readonly cause: 'user' | 'consent' | 'mode-exit';
  };
  'reality:consent-required': {
    readonly forMode: XRRealityMode;
    readonly minimumTier: ConsentTier;
  };
}

/** Convenience listener type. */
export type XROrchestratorListener<K extends XROrchestratorEventName> = (
  payload: XROrchestratorEventMap[K],
) => void;
