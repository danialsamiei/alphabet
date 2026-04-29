/**
 * @module orchestrator/consent-ladder
 * @description
 * `consentLadderMachine` — XState-v5-shaped state machine over the
 * 4-tier consent ladder (`pending → granted(tier 1|2|3) → revoked`).
 *
 * Why an additive machine when `@alphabet/security` already ships
 * `ConsentTierManager`? Because the ladder *transitions* are useful as
 * inspectable, snapshot-testable data:
 *   - consumers can render the diagram in their docs (`toMermaid`),
 *   - UI orchestrators can drive a banner/modal off the machine,
 *   - the underlying `ConsentTierManager` (with persistence + policy
 *     versioning) remains the source of truth for *durable* state.
 *
 * The machine is **stateless w.r.t. storage** — it does not persist
 * itself. Wire `ConsentTierManager` as the listener if you need
 * persistence and `policyVersion` invalidation.
 */

import type { ConsentTier } from '../types/base.js';
import { CONSENT_TIER_LEVEL } from '../types/base.js';
import { createMachine, type Machine } from './machine.js';

export interface ConsentLadderContext {
  readonly tier: ConsentTier;
  readonly grantedAt?: number;
  readonly revokedAt?: number;
  readonly policyVersion: string;
}

export type ConsentLadderEvent =
  | { type: 'GRANT'; tier: ConsentTier; at: number; policyVersion: string }
  | { type: 'REVOKE'; at: number }
  | { type: 'RESET' }
  | { type: 'POLICY_UPDATED'; policyVersion: string };

const initialContext: ConsentLadderContext = {
  tier: 'NO_MEMORY',
  policyVersion: 'v1',
};

export const consentLadderMachine: Machine<ConsentLadderContext, ConsentLadderEvent> =
  createMachine<ConsentLadderContext, ConsentLadderEvent>({
    id: 'consentLadder',
    initial: 'pending',
    context: initialContext,
    states: {
      pending: {
        on: {
          GRANT: { target: 'granted', guard: 'isValidTier', actions: ['recordGrant'] },
        },
      },
      granted: {
        on: {
          GRANT: { target: 'granted', guard: 'isUpgrade', actions: ['recordGrant'] },
          REVOKE: { target: 'revoked', actions: ['recordRevoke'] },
          POLICY_UPDATED: { target: 'pending', actions: ['rotatePolicy'] },
        },
      },
      revoked: {
        on: {
          RESET: { target: 'pending', actions: ['clearAll'] },
        },
      },
    },
    guards: {
      isValidTier: (_ctx, ev) => ev.type === 'GRANT' && ev.tier !== 'NO_MEMORY',
      // Only allow upgrades — downgrade requires a REVOKE first (matches
      // ConsentTierManager invariant: tier never decreases mid-session).
      isUpgrade: (ctx, ev) =>
        ev.type === 'GRANT' &&
        CONSENT_TIER_LEVEL[ev.tier] > CONSENT_TIER_LEVEL[ctx.tier],
    },
    actions: {
      recordGrant: (_ctx, ev) =>
        ev.type === 'GRANT'
          ? { tier: ev.tier, grantedAt: ev.at, policyVersion: ev.policyVersion }
          : {},
      recordRevoke: (_ctx, ev) =>
        ev.type === 'REVOKE' ? { tier: 'NO_MEMORY' as ConsentTier, revokedAt: ev.at } : {},
      rotatePolicy: (_ctx, ev) =>
        ev.type === 'POLICY_UPDATED'
          ? { tier: 'NO_MEMORY' as ConsentTier, policyVersion: ev.policyVersion }
          : {},
      clearAll: () => ({ ...initialContext }),
    },
  });
