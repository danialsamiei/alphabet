/**
 * @module @awaf/core
 * @description
 * پکیج Foundation — صادرکننده اصلی تمام typeها، config، logger، و events.
 * Foundation package — main barrel export for all types, config, logger, and events.
 *
 * @example
 * import { AWAFConfig, AWAFLogger, AWAFEventEmitter } from '@awaf/core';
 * import type { VisitorContext, AWAFRequest, Result } from '@awaf/core';
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export * from './types/index.js';

// ─── Config ───────────────────────────────────────────────────────────────────
export { AWAFConfig } from './config/awaf-config.js';
export type { AWAFConfigOptions, AWAFConfigOverrides } from './config/awaf-config.js';

// ─── Logger ───────────────────────────────────────────────────────────────────
export { AWAFLogger } from './logger/awaf-logger.js';
export type { LogEntry, AWAFLoggerOptions } from './logger/awaf-logger.js';

// ─── Events ───────────────────────────────────────────────────────────────────
export { AWAFEventEmitter } from './events/awaf-events.js';
export type {
  AWAFEventMap,
  AWAFEventName,
  AWAFEventListener,
} from './events/awaf-events.js';

// ─── Handshake ────────────────────────────────────────────────────────────────
export { SignalCollector, EnrichmentPipeline, HandshakeDecisionEngine } from './handshake/index.js';
export type { SignalCollectorOptions } from './handshake/index.js';
