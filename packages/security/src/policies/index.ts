/**
 * @module policies
 * @description
 * Static security policy data — privacy policy version constant, default
 * cross-domain access control list (ACL), and prompt-injection pattern
 * defaults. Kept dependency-free so it can be imported anywhere in the
 * package without creating a cycle.
 *
 * **Limitations.** The defaults here are conservative starting points,
 * not a substitute for a real threat model. Operators are expected to
 * override them via the options accepted by each guard / detector.
 */

import type { MemoryDomain } from '@alphabet/core';

// ─── Privacy policy version ──────────────────────────────────────────────────

/**
 * نسخه پیش‌فرض privacy policy — برای invalidation رضایت در ConsentTierManager.
 * Default privacy policy version. Bump this whenever the policy text
 * changes so that previously-granted consent is invalidated and the
 * visitor is asked to re-consent.
 */
export const DEFAULT_POLICY_VERSION = '2025-04-01';

// ─── Cross-domain ACL ────────────────────────────────────────────────────────

/**
 * نگاشت دامنه‌های حافظه به دامنه‌هایی که اجازه read دارند.
 * Cross-domain read ACL keyed by the *owner* domain. The value is the
 * list of *reader* domains permitted to read from that owner. A reader
 * is always allowed to read its own domain; that invariant is enforced
 * by `MemoryIntegrityGuard`, not encoded here.
 *
 * The defaults below match the Alphabet privacy model:
 *  - `general` is readable by every domain (public).
 *  - `visitor` is strictly isolated — no other domain may read it.
 *  - `class_notes`, `ideas`, `social` are readable by `general` only.
 *  - `site_specific` is readable by `general` and `visitor`.
 *  - `tech_pulse` is readable by `general`, `site_specific`, `visitor`.
 */
export const DEFAULT_DOMAIN_READ_ACL: Readonly<Record<MemoryDomain, readonly MemoryDomain[]>> = {
  general: ['general', 'site_specific', 'visitor', 'class_notes', 'ideas', 'social', 'tech_pulse'],
  site_specific: ['general', 'site_specific', 'visitor'],
  visitor: ['visitor'],
  class_notes: ['general', 'class_notes'],
  ideas: ['general', 'ideas'],
  social: ['general', 'social'],
  tech_pulse: ['general', 'site_specific', 'visitor', 'tech_pulse'],
} as const;

/**
 * دامنه‌هایی که فقط برای admin قابل نوشتن هستند.
 * Domains that may only be written by an actor with `admin` role.
 */
export const ADMIN_ONLY_WRITE_DOMAINS: readonly MemoryDomain[] = ['class_notes', 'tech_pulse'];

// ─── Prompt injection defaults ───────────────────────────────────────────────

/**
 * الگوهای پیش‌فرض prompt injection — به‌صورت محافظه‌کارانه طراحی شده‌اند تا
 * محتوای عادی کاربر را block نکنند.
 * Default heuristic patterns for prompt-injection detection. Each pattern
 * has a weight (the contribution to the cumulative risk score) and a
 * short label used in audit logs.
 *
 * **Important.** These are heuristics, not a complete defence. A
 * production deployment should pair them with output filtering, an LLM
 * sandbox, and human review for high-stakes flows.
 */
export interface PromptInjectionPattern {
  readonly id: string;
  readonly label: string;
  readonly pattern: RegExp;
  readonly weight: number;
}

export const DEFAULT_PROMPT_INJECTION_PATTERNS: readonly PromptInjectionPattern[] = [
  {
    id: 'ignore_previous',
    label: 'Asks the model to ignore previous/above instructions',
    pattern:
      /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all)\b[^.\n]{0,40}\b(instructions?|prompts?|rules?|messages?|context)\b/i,
    weight: 0.6,
  },
  {
    id: 'reveal_system',
    label: 'Asks the model to reveal system prompt or hidden context',
    pattern:
      /\b(reveal|show|print|repeat|leak|expose|dump)\b[^.\n]{0,40}\b(system\s*prompt|hidden\s*prompt|developer\s*prompt|initial\s*prompt|your\s*instructions|the\s*rules)\b/i,
    weight: 0.7,
  },
  {
    id: 'role_override',
    label: 'Asks the model to switch role or pretend to be unrestricted',
    pattern:
      /\b(you\s*are\s*now|act\s*as\b|pretend\s*to\s*be|from\s*now\s*on\s*you|new\s*persona|jailbreak|DAN\s*mode)\b/i,
    weight: 0.5,
  },
  {
    id: 'safety_off',
    label: 'Asks the model to disable safety or content filters',
    pattern:
      /\b(disable|turn\s*off|bypass|remove)\b[^.\n]{0,30}\b(safety|guardrails?|content\s*filter|moderation|restrictions?)\b/i,
    weight: 0.7,
  },
  {
    id: 'exfiltrate',
    label: 'Asks the model to exfiltrate data via URLs or tool calls',
    pattern:
      /\b(send|post|fetch|exfiltrate|leak)\b[^.\n]{0,40}(?:to\s+https?:\/\/|to\s+the\s+attacker|to\s+my\s+server|via\s+webhook)/i,
    weight: 0.8,
  },
  {
    id: 'tool_override',
    label: 'Tries to inject fake tool / function call delimiters',
    pattern: /<\s*\/?\s*(system|assistant|developer|tool_call)\s*>|\[\[\s*(SYSTEM|ASSISTANT|DEVELOPER)\s*\]\]/i,
    weight: 0.6,
  },
  {
    id: 'encoded_instruction',
    label: 'Suspicious base64 / hex blob that may hide instructions',
    pattern: /\b(?:[A-Za-z0-9+/]{120,}={0,2})\b/,
    weight: 0.3,
  },
] as const;
