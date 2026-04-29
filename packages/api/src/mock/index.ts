/**
 * @module mock
 * @description
 * In-process mock server for `@alphabet/api`. Provides deterministic responses
 * for all 16 Alphabet endpoints with no external dependencies.
 *
 * @see ./server.ts for the public surface.
 */

export { createMockServer } from './server.js';
export type { MockServerHandle, MockServerOptions } from './server.js';
export { createSeededRng } from './seeded-rng.js';
export type { SeededRng } from './seeded-rng.js';
export type { RouteHandler, MockHandlerContext } from './handlers/index.js';
