/**
 * @module @awaf/protocols/mcp
 * @description
 * MCP (Model Context Protocol) adapter — exposes AWAF tools to MCP-aware
 * clients without pulling in a heavy MCP server runtime.
 *
 * The adapter provides:
 *   1. Serializable tool manifests (JSON-Schema-compatible inputSchema).
 *   2. Pure handler functions that accept normalized AWAF context and
 *      return normalized AWAF responses.
 *   3. A small registry that wires manifests and handlers together.
 *
 * Consumers can serve the manifests over any transport (stdio, HTTP/SSE,
 * WebSocket) — that is intentionally out of scope for this package.
 */

import { ok, err, type Result } from '@awaf/core';
import {
  protocolError,
  type AwafProtocolError,
} from '../errors/index.js';
import {
  ensureNoPIIInContext,
  evaluateMemoryPermission,
  validateConsentScope,
} from '../normalizers/index.js';
import type {
  AwafProtocolRequest,
  AwafToolContext,
  AwafConsentScope,
  AwafMemoryPermission,
} from '../contract.js';
import type { CapabilityLayer, ConsentTier, MemoryDomain, PrivacySignals } from '@awaf/core';

// ─── Tool Manifests ──────────────────────────────────────────────────────────

/**
 * Minimal JSON-Schema subset used by the AWAF MCP tool manifests. We do
 * not depend on `@modelcontextprotocol/sdk` so that consumers can run
 * the adapter in any environment, including the browser.
 */
export interface JsonSchema {
  readonly type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  readonly properties?: Record<string, JsonSchema>;
  readonly items?: JsonSchema;
  readonly required?: readonly string[];
  readonly enum?: readonly (string | number | boolean)[];
  readonly description?: string;
}

/**
 * Serializable manifest for a single MCP tool. Compatible with the
 * `tools/list` shape from the MCP specification.
 */
export interface AwafMcpToolManifest {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

/** All AWAF MCP tool names. */
export const AWAF_MCP_TOOLS = [
  'context_handshake',
  'memory_query',
  'consent_status',
  'adaptive_layer_explain',
] as const;

/** Type of any AWAF-supported MCP tool name. */
export type AwafMcpToolName = (typeof AWAF_MCP_TOOLS)[number];

/** Frozen list of manifests for all AWAF MCP tools. */
export const AWAF_MCP_TOOL_MANIFESTS: Readonly<Record<AwafMcpToolName, AwafMcpToolManifest>> =
  Object.freeze({
    context_handshake: {
      name: 'context_handshake',
      description:
        'Returns a PII-free snapshot of the visitor context (locale, ' +
        'capability layer, coarse country, consent tier) so the agent ' +
        'can adapt its replies without tracking the user.',
      inputSchema: {
        type: 'object',
        properties: {},
        description: 'No input — context is taken from the AWAF session.',
      },
    },
    memory_query: {
      name: 'memory_query',
      description:
        'Reads memory entries from a specific AWAF memory domain. Access ' +
        'is gated by consent tier; isolated domains require CONSENTED+.',
      inputSchema: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: {
            type: 'string',
            description: 'AWAF memory domain to query.',
            enum: [
              'general',
              'site_specific',
              'visitor',
              'class_notes',
              'ideas',
              'social',
              'tech_pulse',
            ],
          },
          query: {
            type: 'string',
            description: 'Free-text semantic query.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of entries to return (default 10).',
          },
        },
      },
    },
    consent_status: {
      name: 'consent_status',
      description:
        'Returns the visitor’s current consent tier, granted purposes, ' +
        'and whether DNT/GPC is active. Read-only.',
      inputSchema: { type: 'object', properties: {} },
    },
    adaptive_layer_explain: {
      name: 'adaptive_layer_explain',
      description:
        'Explains why a particular UI capability layer was chosen for ' +
        'this visitor (GPU/network/accessibility decision matrix).',
      inputSchema: { type: 'object', properties: {} },
    },
  });

// ─── Tool Result Shapes ──────────────────────────────────────────────────────

/** Result of `context_handshake`. */
export interface ContextHandshakeResult {
  readonly context: AwafToolContext;
}

/** Result of `memory_query`. */
export interface MemoryQueryResult {
  readonly domain: MemoryDomain;
  readonly permission: AwafMemoryPermission;
  readonly entries: readonly { readonly id: string; readonly snippet: string }[];
}

/** Result of `consent_status`. */
export interface ConsentStatusResult {
  readonly tier: ConsentTier;
  readonly privacyRestricted: boolean;
  readonly operations: readonly AwafConsentScope['operations'][number][];
}

/** Result of `adaptive_layer_explain`. */
export interface AdaptiveLayerExplainResult {
  readonly layer: CapabilityLayer | 'UNKNOWN';
  readonly reasons: readonly string[];
}

// ─── Memory Backend Hook ─────────────────────────────────────────────────────

/**
 * Pluggable memory backend. The adapter does not own storage; consumers
 * inject a function that performs the actual lookup once permission has
 * been validated.
 */
export type MemoryQueryBackend = (input: {
  readonly domain: MemoryDomain;
  readonly query: string;
  readonly limit: number;
  readonly context: AwafToolContext;
}) => Promise<readonly { readonly id: string; readonly snippet: string }[]>;

// ─── Adapter ─────────────────────────────────────────────────────────────────

/** Options accepted by `McpAdapter`. */
export interface McpAdapterOptions {
  /** Backend used by `memory_query`. Optional — denied if missing. */
  readonly memoryBackend?: MemoryQueryBackend;
  /**
   * Optional explainer that returns reasons for the current layer. If
   * omitted, the adapter returns a generic explanation.
   */
  readonly layerExplainer?: (context: AwafToolContext) => readonly string[];
}

/**
 * MCP adapter. Stateless except for injected backends.
 */
export class McpAdapter {
  constructor(private readonly options: McpAdapterOptions = {}) {}

  /** Returns the full list of AWAF MCP tool manifests. */
  listTools(): readonly AwafMcpToolManifest[] {
    return AWAF_MCP_TOOLS.map((name) => AWAF_MCP_TOOL_MANIFESTS[name]);
  }

  /**
   * Dispatch a tool call. Validates consent + PII before invoking the
   * specific handler. Pure: no network, no I/O of its own.
   */
  async invoke(
    toolName: string,
    input: unknown,
    request: AwafProtocolRequest,
    privacy: PrivacySignals
  ): Promise<
    Result<
      | ContextHandshakeResult
      | MemoryQueryResult
      | ConsentStatusResult
      | AdaptiveLayerExplainResult,
      AwafProtocolError
    >
  > {
    if (!isAwafMcpTool(toolName)) {
      return err(protocolError('TOOL_NOT_FOUND', `Unknown MCP tool: ${toolName}`));
    }

    const consentResult = validateConsentScope(request.consent, {
      tier: request.context.consentTier,
      privacy,
    });
    if (!consentResult.success) return consentResult;

    const contextResult = ensureNoPIIInContext(request.context);
    if (!contextResult.success) return contextResult;

    switch (toolName) {
      case 'context_handshake':
        return ok<ContextHandshakeResult>({ context: contextResult.data });

      case 'consent_status':
        return ok<ConsentStatusResult>({
          tier: request.context.consentTier,
          privacyRestricted: request.context.privacyRestricted,
          operations: [...request.consent.operations],
        });

      case 'adaptive_layer_explain': {
        const reasons =
          this.options.layerExplainer?.(contextResult.data) ??
          defaultLayerReasons(contextResult.data);
        return ok<AdaptiveLayerExplainResult>({
          layer: contextResult.data.layer ?? 'UNKNOWN',
          reasons,
        });
      }

      case 'memory_query':
        return this.handleMemoryQuery(input, contextResult.data, privacy);

      default: {
        const exhaustive: never = toolName;
        return err(
          protocolError('TOOL_NOT_FOUND', 'Exhaustive check failed', {
            toolName: exhaustive,
          })
        );
      }
    }
  }

  private async handleMemoryQuery(
    input: unknown,
    context: AwafToolContext,
    privacy: PrivacySignals
  ): Promise<Result<MemoryQueryResult, AwafProtocolError>> {
    const parsed = parseMemoryQueryInput(input);
    if (!parsed.success) return parsed;

    const permission = evaluateMemoryPermission(parsed.data.domain, {
      tier: context.consentTier,
      privacy,
    });
    if (!permission.canRead) {
      return err(
        protocolError(
          'MEMORY_PERMISSION_DENIED',
          permission.reason ?? 'Memory read denied',
          { domain: parsed.data.domain, requiredTier: permission.requiredTier }
        )
      );
    }

    if (!this.options.memoryBackend) {
      return ok<MemoryQueryResult>({
        domain: parsed.data.domain,
        permission,
        entries: [],
      });
    }

    const entries = await this.options.memoryBackend({
      domain: parsed.data.domain,
      query: parsed.data.query,
      limit: parsed.data.limit,
      context,
    });
    return ok<MemoryQueryResult>({
      domain: parsed.data.domain,
      permission,
      entries,
    });
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isAwafMcpTool(name: string): name is AwafMcpToolName {
  return (AWAF_MCP_TOOLS as readonly string[]).includes(name);
}

const ALL_DOMAINS: ReadonlySet<MemoryDomain> = new Set<MemoryDomain>([
  'general',
  'site_specific',
  'visitor',
  'class_notes',
  'ideas',
  'social',
  'tech_pulse',
]);

/** Maximum number of memory entries `memory_query` will return. */
const MAX_MEMORY_QUERY_LIMIT = 100;
/** Default number of memory entries when the caller omits `limit`. */
const DEFAULT_MEMORY_QUERY_LIMIT = 10;

interface ParsedMemoryQueryInput {
  readonly domain: MemoryDomain;
  readonly query: string;
  readonly limit: number;
}

function parseMemoryQueryInput(
  input: unknown
): Result<ParsedMemoryQueryInput, AwafProtocolError> {
  if (!input || typeof input !== 'object') {
    return err(
      protocolError('INVALID_PROTOCOL_PAYLOAD', 'memory_query input must be an object')
    );
  }
  const obj = input as Record<string, unknown>;
  const domain = obj['domain'];
  if (typeof domain !== 'string' || !ALL_DOMAINS.has(domain as MemoryDomain)) {
    return err(
      protocolError('INVALID_PROTOCOL_PAYLOAD', 'memory_query.domain is invalid', {
        domain,
      })
    );
  }
  const query = typeof obj['query'] === 'string' ? (obj['query'] as string) : '';
  const rawLimit = obj['limit'];
  const limit =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_MEMORY_QUERY_LIMIT)
      : DEFAULT_MEMORY_QUERY_LIMIT;
  return ok({ domain: domain as MemoryDomain, query, limit });
}

function defaultLayerReasons(context: AwafToolContext): readonly string[] {
  const reasons: string[] = [];
  if (context.privacyRestricted) {
    reasons.push('DNT/GPC active — animations and tracking disabled');
  }
  if (context.layer) {
    reasons.push(`Selected layer: ${context.layer}`);
  } else {
    reasons.push('No capability layer recorded for this session');
  }
  return reasons;
}
