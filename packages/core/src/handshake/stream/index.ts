/**
 * @module handshake/stream
 * @description barrel — context streaming primitives.
 */

export type {
  ContextStreamEvent,
  ContextStreamOptions,
  ContextStreamController,
  ContextStreamHandle,
  SignalSnapshot,
} from './context-stream.js';
export { createContextStream, toAsyncIterable } from './context-stream.js';
