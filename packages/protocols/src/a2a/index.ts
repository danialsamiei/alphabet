/**
 * @module @awaf/protocols/a2a
 * @description
 * A2A-style adapter — normalizes task/artifact style messages (à la
 * Google A2A) into AWAF protocol requests. Dependency-light and
 * extensible; we do not depend on any A2A SDK.
 */

import { ok, err, type Result } from '@awaf/core';
import {
  protocolError,
  type AwafProtocolError,
} from '../errors/index.js';
import {
  ensureNoPIIInContext,
  validateConsentScope,
} from '../normalizers/index.js';
import type {
  AwafProtocolRequest,
  AwafToolContext,
  AwafConsentScope,
} from '../contract.js';
import type { PrivacySignals } from '@awaf/core';

// ─── A2A Message Shapes ──────────────────────────────────────────────────────

/** A single A2A task part (text only — binary parts are out of scope). */
export interface A2ATaskPart {
  readonly kind: 'text' | 'data';
  readonly text?: string;
  readonly data?: Record<string, unknown>;
}

/** A single A2A task message. */
export interface A2ATaskMessage {
  readonly role: 'user' | 'agent' | 'system';
  readonly parts: readonly A2ATaskPart[];
}

/**
 * Incoming A2A task. Mirrors the shape of `task.send` from the A2A
 * specification while remaining intentionally minimal.
 */
export interface A2ATask {
  readonly id: string;
  readonly skill: string;
  readonly messages: readonly A2ATaskMessage[];
  readonly metadata?: {
    readonly context?: AwafToolContext;
    readonly consent?: AwafConsentScope;
    readonly correlationId?: string;
  };
}

/** Serializable agent card describing the AWAF A2A endpoint. */
export interface AwafA2AAgentCard {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly skills: readonly {
    readonly id: string;
    readonly description: string;
    readonly inputModes: readonly ['text'];
    readonly outputModes: readonly ['text', 'data'];
  }[];
}

/** Default agent card published at `/.well-known/agent.json`. */
export const AWAF_A2A_AGENT_CARD: AwafA2AAgentCard = {
  name: 'AWAF Context Agent',
  description:
    'Provides PII-free visitor context, consent status, and adaptive ' +
    'UI layer reasoning to other A2A agents.',
  version: '1.0.0',
  skills: [
    {
      id: 'context.handshake',
      description: 'Return PII-free visitor context for adaptive replies.',
      inputModes: ['text'] as const,
      outputModes: ['text', 'data'] as const,
    },
    {
      id: 'consent.status',
      description: 'Return current consent tier and privacy signals.',
      inputModes: ['text'] as const,
      outputModes: ['text', 'data'] as const,
    },
    {
      id: 'memory.query',
      description: 'Read AWAF memory entries (consent-gated).',
      inputModes: ['text'] as const,
      outputModes: ['text', 'data'] as const,
    },
  ],
} as const;

// ─── Adapter ─────────────────────────────────────────────────────────────────

/** Options accepted by `A2AAdapter`. */
export interface A2AAdapterOptions {
  /**
   * Map A2A skill identifiers to AWAF logical operation names. Allows
   * downstream consumers to extend or override the default mapping
   * without subclassing.
   */
  readonly skillMap?: Readonly<Record<string, string>>;
}

const DEFAULT_SKILL_MAP: Readonly<Record<string, string>> = Object.freeze({
  'context.handshake': 'context.handshake',
  'consent.status': 'consent.status',
  'memory.query': 'memory.query',
});

/**
 * A2A adapter. Converts an `A2ATask` into a normalized
 * `AwafProtocolRequest`. The adapter is dependency-light by design —
 * every transport concern (HTTP, SSE, streaming) is left to the caller.
 */
export class A2AAdapter {
  private readonly skillMap: Readonly<Record<string, string>>;

  constructor(options: A2AAdapterOptions = {}) {
    this.skillMap = { ...DEFAULT_SKILL_MAP, ...(options.skillMap ?? {}) };
  }

  /** Returns the agent card to publish at `/.well-known/agent.json`. */
  getAgentCard(): AwafA2AAgentCard {
    return AWAF_A2A_AGENT_CARD;
  }

  /**
   * Normalize an A2A task into an `AwafProtocolRequest`. Validates
   * structure, looks up the skill mapping, and runs consent + PII
   * validation against the authoritative state.
   */
  normalizeTask(
    task: A2ATask,
    authoritative: { tier: AwafConsentScope['tier']; privacy: PrivacySignals }
  ): Result<AwafProtocolRequest<{ readonly messages: readonly A2ATaskMessage[] }>, AwafProtocolError> {
    if (!task || typeof task !== 'object') {
      return err(protocolError('TASK_INVALID', 'Task must be an object'));
    }
    if (typeof task.id !== 'string' || task.id.length === 0) {
      return err(protocolError('TASK_INVALID', 'Task is missing "id"'));
    }
    if (typeof task.skill !== 'string' || task.skill.length === 0) {
      return err(protocolError('TASK_INVALID', 'Task is missing "skill"'));
    }
    if (!Array.isArray(task.messages) || task.messages.length === 0) {
      return err(protocolError('TASK_INVALID', 'Task must contain at least one message'));
    }

    const operation = this.skillMap[task.skill];
    if (!operation) {
      return err(
        protocolError('UNSUPPORTED_PROTOCOL', `Unknown A2A skill: ${task.skill}`, {
          skill: task.skill,
        })
      );
    }

    const md = task.metadata ?? {};
    if (!md.context || !md.consent) {
      return err(
        protocolError(
          'TASK_INVALID',
          'Task metadata must include both "context" and "consent"'
        )
      );
    }

    const consent: AwafConsentScope = { ...md.consent, tier: authoritative.tier };
    const consentResult = validateConsentScope(consent, authoritative);
    if (!consentResult.success) return consentResult;

    const sanitizedContext: AwafToolContext = {
      ...md.context,
      consentTier: authoritative.tier,
      privacyRestricted:
        authoritative.privacy.dntEnabled || authoritative.privacy.gpcEnabled,
    };
    const contextResult = ensureNoPIIInContext(sanitizedContext);
    if (!contextResult.success) return contextResult;

    return ok({
      protocol: 'A2A',
      operation,
      context: contextResult.data,
      consent: consentResult.data,
      payload: { messages: task.messages },
      correlationId:
        typeof md.correlationId === 'string' && md.correlationId.length > 0
          ? md.correlationId
          : `a2a-${task.id}`,
      receivedAt: new Date().toISOString(),
    });
  }
}
