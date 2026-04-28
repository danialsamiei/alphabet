/**
 * @module handshake/pipeline
 * @description
 * barrel — pipeline primitives برای handshake (Step, compose, parallel, retry, trace).
 */

export type { Step, StepContext, StepContextOptions, ParallelMap } from './step.js';
export {
  defineStep,
  identityStep,
  compose,
  pipe,
  parallel,
  makeStepContext,
} from './step.js';

export type { RetryOptions, AttemptInfo } from './retry.js';
export { withRetry, decorrelatedJitter } from './retry.js';

export type {
  Tracer,
  Span,
  SpanRecord,
  SpanOutcome,
  SpanAttributes,
  TraceSnapshot,
} from './trace.js';
export { TraceCollector, noopTracer } from './trace.js';
