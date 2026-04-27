/**
 * @module @awaf/api
 * @description
 * پکیج API Client — HandshakeClient و re-exports از @awaf/core.
 * API Client package — HandshakeClient + re-exports from @awaf/core.
 */

export type { AWAFRequest, AWAFResponse } from '@awaf/core';

export { HandshakeClient } from './handshake-client.js';
export type { HandshakeClientOptions } from './handshake-client.js';
