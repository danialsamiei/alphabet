/**
 * @module @alphabet/protocols/v2/xr/orchestrator
 * @description
 * **Cross-Reality Orchestrator** — chooses an `XRRealityMode`, manages
 * Spatial Web Layer 0 anchors, and emits actionable hints + lifecycle
 * events for the runtime.
 *
 * The orchestrator composes (never replaces) the existing capability
 * primitives:
 *   • `CapabilityPredictor` and `ProactiveLayerForecaster` from
 *     `@alphabet/protocols/v2/pulse` provide the *fallback* layer the
 *     orchestrator hands back when an XR session cannot be entered.
 *   • The `SpatialLayer0Adapter` interface (in-memory default)
 *     provides anchor persistence — gated by privacy posture.
 *
 * Privacy posture rules (default mapping, callers may override):
 *   • `NO_MEMORY` / `ANONYMOUS` → `on-device-only` (no anchor writes).
 *   • `CONSENTED`               → `session-ephemeral`.
 *   • `ENRICHED`                → `persistent-with-proof` *iff* the
 *     orchestrator is initialised with `consentProofVerified: true`,
 *     otherwise downgrades to `session-ephemeral`.
 *
 * The orchestrator never inspects globals on its own. Callers feed it
 * snapshots via `decide(snapshot, …)` so it remains pure on the server
 * and trivial to test.
 */

import type { CapabilityLayer, ConsentTier, PrivacySignals } from '@alphabet/core';
import { hasPrivacySignal } from '@alphabet/core';
import { ProactiveLayerForecaster, type LayerForecastHint } from '../pulse/index.js';
import type {
  XRCapabilitySnapshot,
  XRDecisionReason,
  XROrchestratorEventMap,
  XROrchestratorEventName,
  XROrchestratorListener,
  XRPrivacyPosture,
  XRRealityDecision,
  XRRealityHint,
  XRRealityMode,
  XRSpatialAnchor,
} from './types.js';
import {
  createInMemorySpatialLayer0Adapter,
  type SpatialLayer0Adapter,
} from './spatial-layer0.js';

// ─── Options ─────────────────────────────────────────────────────────────────

/** Construction options. */
export interface CrossRealityOrchestratorOptions {
  /** Defaults to a fresh in-memory adapter. */
  readonly spatialAdapter?: SpatialLayer0Adapter;
  /**
   * Set to `true` after the SDK has verified a `ConsentProofToken`.
   * Required to unlock `persistent-with-proof` posture for tier
   * `ENRICHED`. Defaults to `false`.
   */
  readonly consentProofVerified?: boolean;
  /** Forwarded to the underlying `ProactiveLayerForecaster`. */
  readonly forecaster?: ProactiveLayerForecaster;
  /**
   * Override jurisdiction restriction. When `true`, the orchestrator
   * never selects an XR mode regardless of capability. Useful when the
   * caller's `VisitorConsentManager` has flagged the visitor's
   * jurisdiction as restricting XR or biometric data collection.
   */
  readonly jurisdictionRestrictsXr?: boolean;
}

/** Inputs to `decide()`. */
export interface XRDecideInput {
  readonly snapshot: XRCapabilitySnapshot;
  readonly consentTier: ConsentTier;
  readonly privacy: PrivacySignals;
  /**
   * Layer the existing UI runtime would render in the absence of XR.
   * Defaults to `R3F_IMMERSIVE` so that `decide()` callers without an
   * active forecaster snapshot still get a meaningful fallback.
   */
  readonly currentLayer?: CapabilityLayer;
}

// ─── Class ───────────────────────────────────────────────────────────────────

const TIER_ORDER: Record<ConsentTier, number> = {
  NO_MEMORY: 0,
  ANONYMOUS: 1,
  CONSENTED: 2,
  ENRICHED: 3,
};

/**
 * Battery level below which the orchestrator refuses to enter an XR
 * mode. WebXR sessions are GPU/sensor heavy and continuing them on a
 * device with < 15% battery degrades the visitor experience.
 */
const BATTERY_LOW_THRESHOLD = 0.15;

/**
 * `CrossRealityOrchestrator` — see module-level docs.
 *
 * Stateful: tracks the current decision, attached anchors, and event
 * subscribers. Safe to instantiate one per session. **Not** safe to
 * share across sessions — anchors and listeners are per-instance.
 *
 * @example
 * const xr = new CrossRealityOrchestrator();
 * xr.on('reality:downgrade', ({ from, to, reasons }) => log(from, to, reasons));
 * const decision = xr.decide({ snapshot, consentTier: 'CONSENTED', privacy });
 * if (decision.mode === 'webxr-ar') startArSession();
 */
export class CrossRealityOrchestrator {
  private current: XRRealityMode = 'flat';
  private readonly spatialAdapter: SpatialLayer0Adapter;
  private readonly consentProofVerified: boolean;
  private readonly jurisdictionRestrictsXr: boolean;
  private readonly forecaster: ProactiveLayerForecaster;
  private readonly listeners = new Map<XROrchestratorEventName, Array<(p: unknown) => void>>();
  private readonly anchors = new Map<string, XRSpatialAnchor>();
  private lastDecision: XRRealityDecision | undefined;

  constructor(options: CrossRealityOrchestratorOptions = {}) {
    this.spatialAdapter = options.spatialAdapter ?? createInMemorySpatialLayer0Adapter();
    this.consentProofVerified = options.consentProofVerified === true;
    this.jurisdictionRestrictsXr = options.jurisdictionRestrictsXr === true;
    this.forecaster = options.forecaster ?? new ProactiveLayerForecaster();
  }

  // ─── Decide ────────────────────────────────────────────────────────────────

  /**
   * Pure decision: given a capability snapshot + consent context,
   * choose the richest XR mode the user has consented to and supply
   * the safe fallback layer.
   */
  decide(input: XRDecideInput): XRRealityDecision {
    const { snapshot, consentTier, privacy } = input;
    const reasons: XRDecisionReason[] = [];
    const fallbackLayer = input.currentLayer ?? 'R3F_IMMERSIVE';
    const previous = this.current;

    // Hard refusal paths.
    if (this.jurisdictionRestrictsXr) reasons.push('jurisdiction-restriction');
    if (hasPrivacySignal(privacy)) reasons.push('privacy-signal-active');
    if (snapshot.prefersReducedMotion) reasons.push('reduced-motion');
    if (typeof snapshot.batteryLevel === 'number' && snapshot.batteryLevel < BATTERY_LOW_THRESHOLD) {
      reasons.push('battery-low');
    }
    if (
      snapshot.networkType === '2g' ||
      snapshot.networkType === 'slow-2g'
    ) {
      reasons.push('network-poor');
    }

    const xrBlocked =
      reasons.includes('jurisdiction-restriction') ||
      reasons.includes('privacy-signal-active') ||
      reasons.includes('reduced-motion');

    if (!snapshot.webXrAvailable) reasons.push('no-webxr');

    // Pick the richest mode the snapshot + tier + privacy support.
    let mode: XRRealityMode = 'flat';
    if (
      !xrBlocked &&
      snapshot.spatialLayer0Available &&
      snapshot.webXrAvailable &&
      TIER_ORDER[consentTier] >= TIER_ORDER.CONSENTED
    ) {
      mode = 'spatial-layer-0';
      reasons.push('capability-allowed');
    } else if (
      !xrBlocked &&
      snapshot.immersiveArSupported &&
      TIER_ORDER[consentTier] >= TIER_ORDER.CONSENTED
    ) {
      mode = 'webxr-ar';
      reasons.push('capability-allowed');
    } else if (
      !xrBlocked &&
      snapshot.immersiveVrSupported &&
      TIER_ORDER[consentTier] >= TIER_ORDER.CONSENTED
    ) {
      mode = 'webxr-vr';
      reasons.push('capability-allowed');
    } else {
      // Map fallback layer → flat / css-3d / r3f.
      mode = mapLayerToFlatMode(fallbackLayer);
      if (
        !xrBlocked &&
        TIER_ORDER[consentTier] < TIER_ORDER.CONSENTED &&
        (snapshot.immersiveArSupported || snapshot.immersiveVrSupported)
      ) {
        reasons.push('consent-tier-too-low');
      } else if (
        !xrBlocked &&
        snapshot.webXrAvailable &&
        !snapshot.immersiveArSupported &&
        !snapshot.immersiveVrSupported
      ) {
        reasons.push('no-immersive-session');
      } else if (
        !snapshot.spatialLayer0Available &&
        snapshot.webXrAvailable &&
        TIER_ORDER[consentTier] >= TIER_ORDER.CONSENTED &&
        !xrBlocked
      ) {
        reasons.push('spatial-layer0-unavailable');
      }
      reasons.push('fallback-to-capability-layer');
    }

    const privacyPosture = this.derivePosture(consentTier, mode, {
      privacySignalActive: hasPrivacySignal(privacy),
      jurisdictionRestricted: this.jurisdictionRestrictsXr,
    });
    const decision: XRRealityDecision = {
      mode,
      fallbackLayer,
      privacyPosture,
      reasons,
    };

    // Side-effects: emit transition events + remember.
    if (mode !== previous) {
      const direction = modeRank(mode) > modeRank(previous) ? 'reality:upgrade' : 'reality:downgrade';
      if (direction === 'reality:downgrade') {
        this.emit('reality:downgrade', { from: previous, to: mode, reasons });
        // Revoke anchors that the new posture cannot keep.
        void this.revokeIncompatibleAnchors(privacyPosture).catch(() => undefined);
      } else {
        this.emit('reality:upgrade', { from: previous, to: mode });
      }
    }

    // Surface tier-too-low hint as an event so consumers can prompt for consent.
    if (reasons.includes('consent-tier-too-low') && mode !== 'webxr-ar' && mode !== 'webxr-vr') {
      const target: XRRealityMode = snapshot.immersiveArSupported ? 'webxr-ar' : 'webxr-vr';
      this.emit('reality:consent-required', { forMode: target, minimumTier: 'CONSENTED' });
    }

    this.current = mode;
    this.lastDecision = decision;
    return decision;
  }

  /** Returns the most recent decision, if any. */
  getCurrentDecision(): XRRealityDecision | undefined {
    return this.lastDecision;
  }

  // ─── Anchors ───────────────────────────────────────────────────────────────

  /**
   * Attach a Spatial Web Layer 0 anchor. The orchestrator enforces
   * tier + posture invariants before forwarding to the adapter.
   */
  async attachAnchor(anchor: XRSpatialAnchor): Promise<{ readonly success: boolean }> {
    const decision = this.lastDecision;
    if (decision === undefined) {
      this.emit('reality:consent-required', { forMode: 'spatial-layer-0', minimumTier: 'CONSENTED' });
      return { success: false };
    }
    const r = await this.spatialAdapter.attach(anchor, decision.privacyPosture);
    if (!r.success) return { success: false };
    this.anchors.set(anchor.id, anchor);
    this.emit('reality:anchor-added', { anchorId: anchor.id, scope: anchor.scope });
    return { success: true };
  }

  /** Revoke a single anchor. Idempotent. */
  async revokeAnchor(
    anchorId: string,
    cause: 'user' | 'consent' | 'mode-exit' = 'user',
  ): Promise<void> {
    if (this.anchors.has(anchorId)) {
      this.anchors.delete(anchorId);
      await this.spatialAdapter.revoke(anchorId);
      this.emit('reality:anchor-revoked', { anchorId, cause });
    }
  }

  /** Snapshot of attached anchor ids (no PII). */
  listAnchorIds(): readonly string[] {
    return [...this.anchors.keys()];
  }

  /** Replay through the underlying forecaster + ours, returning the union. */
  forecast(): readonly (XRRealityHint | LayerForecastHint)[] {
    const out: (XRRealityHint | LayerForecastHint)[] = [];
    const layerHints = this.forecaster.forecast();
    for (const h of layerHints) out.push(h);
    if (this.lastDecision !== undefined) {
      out.unshift({ kind: 'no-change', currentMode: this.lastDecision.mode });
    }
    return out;
  }

  /** Forwarded to the inner forecaster — keeps the surface unified. */
  observe(snapshot: Parameters<ProactiveLayerForecaster['observe']>[0]): void {
    this.forecaster.observe(snapshot);
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends XROrchestratorEventName>(
    event: K,
    listener: XROrchestratorListener<K>,
  ): () => void {
    let bucket = this.listeners.get(event);
    if (bucket === undefined) {
      bucket = [];
      this.listeners.set(event, bucket);
    }
    const wrapped = listener as (p: unknown) => void;
    bucket.push(wrapped);
    return () => {
      const b = this.listeners.get(event);
      if (b === undefined) return;
      const idx = b.indexOf(wrapped);
      if (idx !== -1) b.splice(idx, 1);
    };
  }

  /** Reset internal state — useful for tests. */
  reset(): void {
    this.current = 'flat';
    this.lastDecision = undefined;
    this.anchors.clear();
    this.listeners.clear();
    this.forecaster.reset();
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private emit<K extends XROrchestratorEventName>(
    event: K,
    payload: XROrchestratorEventMap[K],
  ): void {
    const bucket = this.listeners.get(event);
    if (bucket === undefined) return;
    for (const fn of [...bucket]) {
      try {
        fn(payload);
      } catch {
        // Listener errors are swallowed; orchestrator is not the place
        // to fan out logging.
      }
    }
  }

  private derivePosture(
    tier: ConsentTier,
    mode: XRRealityMode,
    flags: { readonly privacySignalActive: boolean; readonly jurisdictionRestricted: boolean },
  ): XRPrivacyPosture {
    // Hard privacy signals collapse the posture regardless of tier or mode —
    // the orchestrator must never persist spatial telemetry under DNT/GPC or
    // a restricted jurisdiction.
    if (flags.privacySignalActive || flags.jurisdictionRestricted) {
      return 'on-device-only';
    }
    if (mode === 'flat' || mode === 'css-3d' || mode === 'r3f') {
      // Non-XR modes still report a posture so consumers can audit.
      return TIER_ORDER[tier] >= TIER_ORDER.CONSENTED ? 'session-ephemeral' : 'on-device-only';
    }
    if (TIER_ORDER[tier] < TIER_ORDER.CONSENTED) return 'on-device-only';
    if (TIER_ORDER[tier] === TIER_ORDER.CONSENTED) return 'session-ephemeral';
    // ENRICHED.
    return this.consentProofVerified ? 'persistent-with-proof' : 'session-ephemeral';
  }

  private async revokeIncompatibleAnchors(newPosture: XRPrivacyPosture): Promise<void> {
    if (newPosture !== 'on-device-only') return;
    for (const [id, a] of this.anchors) {
      if (a.scope === 'world') {
        this.anchors.delete(id);
        await this.spatialAdapter.revoke(id);
        this.emit('reality:anchor-revoked', { anchorId: id, cause: 'consent' });
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODE_RANK: Record<XRRealityMode, number> = {
  flat: 0,
  'css-3d': 1,
  r3f: 2,
  'webxr-vr': 3,
  'webxr-ar': 4,
  'spatial-layer-0': 5,
};

function modeRank(mode: XRRealityMode): number {
  return MODE_RANK[mode];
}

function mapLayerToFlatMode(layer: CapabilityLayer): XRRealityMode {
  switch (layer) {
    case 'R3F_IMMERSIVE':
      return 'r3f';
    case 'CSS_3D':
      return 'css-3d';
    case 'CANVAS_2D':
    case 'STATIC_HTML':
    case 'TEXT_ONLY':
      return 'flat';
  }
}
