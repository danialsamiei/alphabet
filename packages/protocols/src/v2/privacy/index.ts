/**
 * @module @alphabet/protocols/v2/privacy
 * @description
 * Privacy-preserving prompt engineering helpers for AlphabetProtocol v2.
 *
 *   • `redactPromptPII` — runs a regex-based PII pass over chat messages
 *     before dispatch. Mirrors `@alphabet/security`'s redactor without
 *     bundling it as a dep, so the protocols package stays at the
 *     bottom of the workspace dep tree.
 *   • `injectConsentAwareContext` — produces a system prelude built
 *     from the visitor's `AlphabetToolContext`, restricted to fields the
 *     current consent tier permits. DNT/GPC and `privacyRestricted`
 *     suppress personalization-level fields entirely.
 *
 * Both helpers are pure — they return new arrays/strings and never
 * mutate input.
 */

import { canPersonalize, hasPrivacySignal, type PrivacySignals } from '@alphabet/core';
import type { AlphabetChatMessage } from '../types.js';
import type { AlphabetToolContext } from '../../contract.js';

// ─── PII redactor ────────────────────────────────────────────────────────────

/** Patterns mirrored from `@alphabet/security` PII redactor (high-confidence). */
const REDACTORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/gi, '[email]'],
  [/\+?\d[\d\s().-]{7,}\d/g, '[phone]'],
  [/\b(?:\d[ -]*?){13,19}\b/g, '[card]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ipv4]'],
  // JWTs (header.payload.signature)
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[jwt]'],
  // AWS access keys
  [/\bAKIA[0-9A-Z]{16}\b/g, '[aws-access-key]'],
  // GitHub tokens
  [/\bghp_[A-Za-z0-9]{36}\b/g, '[github-token]'],
  // Google API keys
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '[google-api-key]'],
];

/** Result of a redaction pass. */
export interface RedactionReport {
  readonly redactedCount: number;
  /** Distinct kinds of PII redacted (e.g. ['email', 'phone']). */
  readonly kinds: readonly string[];
}

/** Redact a single string. */
export function redactPromptString(input: string): {
  readonly text: string;
  readonly report: RedactionReport;
} {
  let text = input;
  let count = 0;
  const kinds = new Set<string>();
  for (const [re, replacement] of REDACTORS) {
    const matches = text.match(re);
    if (matches !== null) {
      count += matches.length;
      kinds.add(replacement.replace(/[[\]]/g, ''));
      text = text.replace(re, replacement);
    }
  }
  return { text, report: { redactedCount: count, kinds: [...kinds] } };
}

/**
 * Run PII redaction over every message's `content`. Returns the new
 * message list and an aggregate report.
 */
export function redactPromptPII(messages: readonly AlphabetChatMessage[]): {
  readonly messages: readonly AlphabetChatMessage[];
  readonly report: RedactionReport;
} {
  const kinds = new Set<string>();
  let count = 0;
  const out = messages.map((m) => {
    const { text, report } = redactPromptString(m.content);
    count += report.redactedCount;
    for (const k of report.kinds) kinds.add(k);
    return text === m.content ? m : { ...m, content: text };
  });
  return { messages: out, report: { redactedCount: count, kinds: [...kinds] } };
}

// ─── Consent-aware context injection ─────────────────────────────────────────

/**
 * Options for `injectConsentAwareContext`. `privacy` is the
 * authoritative privacy-signal state held by the server-side consent
 * manager.
 */
export interface ConsentAwareInjectionOptions {
  readonly privacy: PrivacySignals;
  /** Optional human-readable preamble (defaults to a neutral disclaimer). */
  readonly preamble?: string;
}

const DEFAULT_PREAMBLE =
  'Alphabet runtime context (read-only, PII-free). Adapt your response to the user without violating their consent or DNT/GPC preferences.';

/**
 * Build a consent-aware system prelude from `AlphabetToolContext`. Fields
 * are filtered by the visitor's consent tier and active privacy
 * signals:
 *
 *   • `privacyRestricted === true` (DNT/GPC) → only consent + locale,
 *     no behavioural personalization fields.
 *   • Tier `NO_MEMORY` / `ANONYMOUS` → coarse-only context.
 *   • Tier `CONSENTED` / `ENRICHED` → full context (still PII-free).
 *
 * The result is a `system` message ready to be prepended to the
 * conversation.
 */
export function injectConsentAwareContext(
  context: AlphabetToolContext,
  options: ConsentAwareInjectionOptions,
): AlphabetChatMessage {
  const { privacy } = options;
  const allowPersonalization =
    canPersonalize(context.consentTier, privacy) && !context.privacyRestricted;

  const lines: string[] = [];
  lines.push(options.preamble ?? DEFAULT_PREAMBLE);
  lines.push(`consent_tier: ${context.consentTier}`);
  if (typeof context.locale === 'string') {
    lines.push(`locale: ${context.locale}`);
  }
  if (hasPrivacySignal(privacy) || context.privacyRestricted) {
    lines.push('privacy_signal: active (DNT or GPC)');
    lines.push('directive: do not personalize, do not store memory, prefer neutral phrasing');
  }
  if (allowPersonalization) {
    if (typeof context.country === 'string') {
      lines.push(`country: ${context.country}`);
    }
    if (typeof context.layer === 'string') {
      lines.push(`ui_layer: ${context.layer}`);
    }
  }
  return {
    role: 'system',
    content: lines.join('\n'),
    priority: Number.MAX_SAFE_INTEGER,
  };
}
