/**
 * @module effect
 * @description
 * In-house Effect-style runtime for `@alphabet/core`. Additive subpath —
 * the v1 default barrel is unchanged.
 *
 * @see ./effect.ts        — `Effect<R,E,A>` IR + runner
 * @see ./cause.ts         — failure tree (`Fail` / `Die` / `Interrupt`)
 * @see ./exit.ts          — `Exit<E,A>` ↔ `Result<A, AlphabetError>` bridge
 * @see ./schedule.ts      — exponential + jitter retry policies
 * @see ./layer.ts         — DI container `Layer<R>`
 * @see ./schema.ts        — `Schema<A>` over `contracts/runtime/structural`
 * @see ./adapters.ts      — Effect view of SignalCollector/Enrichment/Decision
 *
 * @example
 * import { handshakeE, runEffect, exitToResult } from '@alphabet/core/effect';
 *
 * const exit = await runEffect(handshakeE(), undefined);
 * const result = exitToResult(exit);
 * if (result.success) console.log(result.data.selectedLayer);
 */

export type { Cause } from './cause.js';
export {
  causeEmpty,
  causeFail,
  causeDie,
  causeInterrupt,
  causeThen,
  causeBoth,
  causeIsFail,
  causeIsDie,
  causeIsInterrupted,
  causeFailures,
  causeDefects,
  causePretty,
} from './cause.js';

export type { Exit } from './exit.js';
export {
  exitSuccess,
  exitFailure,
  exitIsSuccess,
  exitIsFailure,
  exitToResult,
} from './exit.js';

export type { Effect } from './effect.js';
export {
  succeed,
  fail,
  die,
  sync,
  syncEither,
  async,
  asyncExit,
  tryPromise,
  map,
  flatMap,
  catchAll,
  mapError,
  provide,
  zip,
  all,
  race,
  isEffect,
  runEffect,
} from './effect.js';

export type { Schedule, ScheduleRandom } from './schedule.js';
export {
  scheduleNever,
  scheduleRecurs,
  scheduleExponential,
  scheduleExponentialJitter,
  scheduleBoth,
  retry,
} from './schedule.js';

export type { Layer } from './layer.js';
export { layerSucceed, layerSync, layerMerge } from './layer.js';

export type { Schema } from './schema.js';
export { fromValidator, refine, transform, s } from './schema.js';

export { collectE, enrichE, decideE, handshakeE } from './adapters.js';
