/**
 * @module contracts/runtime
 * @description
 * Runtime validation primitives used at the Alphabet API boundary.
 *
 * `@alphabet/core/contracts/runtime` is an **additive** subpath: it is not part
 * of the default barrel and does not change any existing exports. Consumers
 * opt in via:
 *
 * @example
 * import { v, alphabetResponseSchema } from '@alphabet/core/contracts/runtime';
 *
 * @see ../../docs/IMPLEMENTATION_STATUS.md (W1.1)
 */

export * from './validator.js';
export * from './structural.js';
export * from './schemas.js';
