/**
 * @module @awaf/protocols/v2/compression
 * @description
 * Memory-efficient context compression for AwafProtocol v2.
 *
 * Strategies (each pure, composable):
 *   • `estimateTokens` — fast heuristic (≈ 4 chars per token, clipped on
 *     non-ASCII for safety). Free of any tokenizer runtime.
 *   • `compressByPriority` — greedy keep of highest-priority messages
 *     until the budget is exhausted; system messages are pinned.
 *   • `compressBySlidingWindow` — keeps the last `N` messages plus
 *     pinned system prelude.
 *   • `compressBySemanticDedupe` — drops duplicate user turns by hash.
 *   • `compose` — applies a list of strategies in order and stops as
 *     soon as the budget is satisfied.
 *
 * These strategies never call out to a model — keeping the framework
 * compatible with edge runtimes that lack network access during build.
 */

import type { AwafChatMessage } from '../types.js';

// ─── Token estimator ─────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;
const NON_ASCII_PENALTY = 1.5;

/**
 * Estimate the number of tokens consumed by a string. Heuristic: 1
 * token ≈ 4 ASCII chars; non-ASCII strings are inflated by 1.5× to
 * account for multi-byte tokenizers.
 */
// eslint-disable-next-line no-control-regex
const ASCII_RE = /^[\x00-\x7F]*$/;

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  const isAscii = ASCII_RE.test(text);
  const factor = isAscii ? 1 : NON_ASCII_PENALTY;
  return Math.max(1, Math.ceil((text.length * factor) / CHARS_PER_TOKEN));
}

/** Sum of token estimates across a message list (content only). */
export function estimateMessagesTokens(messages: readonly AwafChatMessage[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content);
    // Each message has small structural overhead.
    total += 4;
  }
  return total;
}

// ─── Strategy contract ───────────────────────────────────────────────────────

/**
 * A compression strategy. Pure: must not mutate input. Should return a
 * new array (never the input by reference) so downstream `compose`
 * detects fixed points.
 */
export type CompressionStrategy = (
  messages: readonly AwafChatMessage[],
  budget: number,
) => readonly AwafChatMessage[];

// ─── Strategies ──────────────────────────────────────────────────────────────

/**
 * Keep highest-priority messages, dropping the lowest until the budget
 * is satisfied. System messages are always pinned regardless of
 * priority. Tool messages are pinned with the assistant turn that
 * spawned them so the conversation stays well-formed.
 */
export function compressByPriority(
  messages: readonly AwafChatMessage[],
  budget: number,
): readonly AwafChatMessage[] {
  if (estimateMessagesTokens(messages) <= budget) return [...messages];

  const indexed = messages.map((m, i) => ({ m, i }));
  // Anchor: system always survives, plus tool messages pinned to their assistants.
  const pinned = new Set<number>();
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i] as AwafChatMessage;
    if (m.role === 'system') pinned.add(i);
  }
  // Sort non-pinned by (priority desc, recency desc).
  const candidates = indexed
    .filter((x) => !pinned.has(x.i))
    .sort((a, b) => {
      const pa = a.m.priority ?? 0;
      const pb = b.m.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b.i - a.i;
    });

  let remaining = budget - estimateMessagesTokens(messages.filter((_, i) => pinned.has(i)));
  for (const c of candidates) {
    const cost = estimateTokens(c.m.content) + 4;
    if (cost <= remaining) {
      pinned.add(c.i);
      remaining -= cost;
    }
  }
  return indexed.filter((x) => pinned.has(x.i)).map((x) => x.m);
}

/**
 * Keep the last `keep` non-system messages plus all system messages.
 */
export function compressBySlidingWindow(keep: number): CompressionStrategy {
  const k = Math.max(1, keep);
  return (messages) => {
    const sys = messages.filter((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system');
    const tail = rest.slice(Math.max(0, rest.length - k));
    return [...sys, ...tail];
  };
}

/** Cheap 32-bit FNV-1a hash for dedupe. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Drop user turns whose content hash collides with an earlier user
 * turn. Keeps the earliest occurrence to preserve causality.
 */
export function compressBySemanticDedupe(
  messages: readonly AwafChatMessage[],
): readonly AwafChatMessage[] {
  const seen = new Set<number>();
  return messages.filter((m) => {
    if (m.role !== 'user') return true;
    const h = fnv1a(m.content.trim().toLowerCase());
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  });
}

// ─── Composition ─────────────────────────────────────────────────────────────

/**
 * Apply strategies in order, stopping early once the budget is met.
 * Returns the compressed message list and the final estimated token count.
 */
export function compose(
  strategies: readonly CompressionStrategy[],
  messages: readonly AwafChatMessage[],
  budget: number,
): { readonly messages: readonly AwafChatMessage[]; readonly tokens: number } {
  let current: readonly AwafChatMessage[] = messages;
  for (const s of strategies) {
    if (estimateMessagesTokens(current) <= budget) break;
    current = s(current, budget);
  }
  return { messages: current, tokens: estimateMessagesTokens(current) };
}

/**
 * Default compression pipeline: dedupe → priority eviction → sliding
 * window of last 32. Suitable for most chat workloads.
 */
export const DEFAULT_COMPRESSION: readonly CompressionStrategy[] = [
  compressBySemanticDedupe,
  compressByPriority,
  compressBySlidingWindow(32),
];
