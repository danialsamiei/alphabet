/**
 * @module @alphabet/core
 * @description
 * پکیج Foundation — صادرکننده اصلی تمام typeها، config، logger، و events.
 * Foundation package — main barrel export for all types, config, logger, and events.
 *
 * @example
 * import { AlphabetConfig, AlphabetLogger, AlphabetEventEmitter } from '@alphabet/core';
 * import type { VisitorContext, AlphabetRequest, Result } from '@alphabet/core';
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export * from './types/index.js';

// ─── Config ───────────────────────────────────────────────────────────────────
export { AlphabetConfig } from './config/alphabet-config.js';
export type { AlphabetConfigOptions, AlphabetConfigOverrides } from './config/alphabet-config.js';

// ─── Logger ───────────────────────────────────────────────────────────────────
export { AlphabetLogger } from './logger/alphabet-logger.js';
export type { LogEntry, AlphabetLoggerOptions } from './logger/alphabet-logger.js';

// ─── Events ───────────────────────────────────────────────────────────────────
export { AlphabetEventEmitter } from './events/alphabet-events.js';
export type {
  AlphabetEventMap,
  AlphabetEventName,
  AlphabetEventListener,
} from './events/alphabet-events.js';

// ─── Handshake ────────────────────────────────────────────────────────────────
export {
  SignalCollector,
  EnrichmentPipeline,
  HandshakeDecisionEngine,
  HandshakeOrchestrator,
  pipeline,
  stream,
  predictor,
  stateMachine,
} from './handshake/index.js';
export type {
  SignalCollectorOptions,
  HandshakeOrchestratorOptions,
  HandshakeRunOptions,
  HandshakeOutcome,
  HandshakePhase,
} from './handshake/index.js';

// ─── Privacy ──────────────────────────────────────────────────────────────────
export {
  canStoreMemory,
  canPersonalize,
  canUseAnalytics,
  canUsePreciseGeo,
  hasPrivacySignal,
  DEFAULT_K_ANONYMITY_THRESHOLD,
} from './privacy/index.js';
export type { PrivacySignals } from './privacy/index.js';

// ─── Contracts (route constants, intent vocabularies) ────────────────────────
export * from './contracts/index.js';
