/**
 * @module pii/redactor
 * @description
 * PII redaction utilities — تشخیص و پاک‌سازی ایمیل، شماره تماس، توکن‌ها،
 * و access keyهای واضح قبل از log کردن یا ارسال به سیستم‌های پایین‌دستی.
 *
 * PII redaction utilities. Detects and redacts the most common, *high-
 * confidence* PII patterns: email addresses, phone-like strings, JWTs,
 * cloud access-key-like strings (AWS, Google, GitHub, Slack), and long
 * hex / base64 secrets.
 *
 * **Limitations.** This is regex-based and cannot detect free-form names
 * or addresses, locale-specific national-id formats, or PII embedded in
 * binary blobs. It is designed to satisfy the Alphabet rule *"no PII in logs
 * by default"* — not to act as a full data-loss-prevention (DLP) system.
 * For high-stakes flows, pair with a server-side DLP tool.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * نوع PII شناسایی‌شده در متن.
 * Kind of PII detected. The `secret` kind is used for high-entropy
 * tokens that *look* like secrets but cannot be classified more
 * specifically.
 */
export type PIIKind =
  | 'email'
  | 'phone'
  | 'jwt'
  | 'aws_access_key'
  | 'aws_secret_key'
  | 'google_api_key'
  | 'github_token'
  | 'slack_token'
  | 'private_key_block'
  | 'ipv4'
  | 'credit_card'
  | 'secret';

/** سطح سخت‌گیری redaction. */
export type RedactionStrictness = 'lenient' | 'standard' | 'strict';

/** یک یافته PII در متن. */
export interface PIIFinding {
  readonly kind: PIIKind;
  /** فاصله شروع در متن اصلی. */
  readonly start: number;
  /** فاصله پایان (انحصاری) در متن اصلی. */
  readonly end: number;
  /**
   * نمونه redacted از مقدار — برای debug. هرگز مقدار خام را شامل نمی‌شود.
   * A redacted preview, e.g. `"a***@example.com"`. The raw value is
   * never returned.
   */
  readonly preview: string;
}

/** خروجی `redactPII`. */
export interface RedactionResult {
  /** متن با مقدارهای PII جایگزین‌شده. */
  readonly redacted: string;
  /** فهرست یافته‌ها (مرتب‌شده بر اساس start). */
  readonly findings: readonly PIIFinding[];
}

/** گزینه‌های redaction. */
export interface RedactPIIOptions {
  /** سطح سخت‌گیری — پیش‌فرض `'standard'`. */
  readonly strictness?: RedactionStrictness;
  /**
   * متن جایگزین — پیش‌فرض `[REDACTED:<kind>]`. مقدار خام هرگز عبور داده
   * نمی‌شود؛ تابع فقط `kind` و `index` را در اختیار می‌گذارد.
   */
  readonly replacer?: (kind: PIIKind, index: number) => string;
}

// ─── Patterns ────────────────────────────────────────────────────────────────

interface PIIRule {
  readonly kind: PIIKind;
  readonly pattern: RegExp;
  /**
   * Levels at which this rule fires. `lenient` only includes the most
   * unambiguous patterns; `standard` includes the operational baseline;
   * `strict` adds aggressive heuristics that may produce false positives.
   */
  readonly levels: readonly RedactionStrictness[];
  readonly previewLength: number;
}

const RULES: readonly PIIRule[] = [
  // Email — high confidence, fires at every level.
  {
    kind: 'email',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 1,
  },
  // JWT — three base64url segments separated by dots.
  {
    kind: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 4,
  },
  // AWS access key id — 16-128 chars starting with AKIA / ASIA.
  {
    kind: 'aws_access_key',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16,30}\b/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 4,
  },
  // AWS secret-access-key heuristic: 40 base64 chars after `aws_secret`
  // marker (or as a standalone 40-char base64).
  {
    kind: 'aws_secret_key',
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
    levels: ['strict'],
    previewLength: 4,
  },
  // Google API key — fixed prefix.
  {
    kind: 'google_api_key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 4,
  },
  // GitHub PAT / fine-grained token.
  {
    kind: 'github_token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,255}\b/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 4,
  },
  // Slack token.
  {
    kind: 'slack_token',
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,72}\b/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 4,
  },
  // PEM private key blocks.
  {
    kind: 'private_key_block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
    levels: ['lenient', 'standard', 'strict'],
    previewLength: 0,
  },
  // Phone — international or local 7-15 digits with optional separators.
  // We require at least 7 digits to avoid hitting plain numbers.
  {
    kind: 'phone',
    pattern: /(?:\+?\d[\s-]?){7,15}\d/g,
    levels: ['standard', 'strict'],
    previewLength: 2,
  },
  // IPv4 — strict only, since CIDR strings are common in legitimate logs
  // and we do not want to mask them by default.
  {
    kind: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    levels: ['strict'],
    previewLength: 0,
  },
  // Credit card — Luhn-shaped 13-19 digits with optional separators.
  {
    kind: 'credit_card',
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    levels: ['standard', 'strict'],
    previewLength: 4,
  },
  // High-entropy generic secret — last so other rules win first.
  {
    kind: 'secret',
    pattern: /\b[A-Za-z0-9_-]{40,}\b/g,
    levels: ['strict'],
    previewLength: 4,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPreview(value: string, prefixLen: number): string {
  if (prefixLen <= 0) return '***';
  if (value.length <= prefixLen) return '***';
  return `${value.slice(0, prefixLen)}***`;
}

function defaultReplacer(kind: PIIKind): string {
  return `[REDACTED:${kind}]`;
}

/**
 * بازه‌های پوشاننده را فیلتر می‌کند — اگر یافته جدید با یافته قبلی
 * overlap داشت، آن را رد می‌کند (اولین یافته برنده است).
 * Filter findings to non-overlapping ranges. Findings are produced in
 * rule order, which is intentionally specific-before-generic so the
 * specific labels (e.g. `aws_access_key`) win over the generic
 * `secret` rule when both could match.
 */
function dedupeOverlap(findings: readonly PIIFinding[]): PIIFinding[] {
  const sorted = [...findings].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PIIFinding[] = [];
  let lastEnd = -1;
  for (const f of sorted) {
    if (f.start >= lastEnd) {
      out.push(f);
      lastEnd = f.end;
    }
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect PII in a piece of text without modifying it.
 *
 * @param input - متن ورودی
 * @param options - گزینه‌ها
 * @returns فهرست یافته‌ها — همراه با preview امن
 *
 * @example
 * detectPII("Email me at alice@example.com");
 * // [{ kind: 'email', start: 12, end: 30, preview: 'a***@example.com' }]
 */
export function detectPII(input: string, options: RedactPIIOptions = {}): readonly PIIFinding[] {
  const { strictness = 'standard' } = options;
  if (input.length === 0) return [];
  const raw: PIIFinding[] = [];
  for (const rule of RULES) {
    if (!rule.levels.includes(strictness)) continue;
    // Re-create the regex per call so global state does not leak across invocations.
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(input)) !== null) {
      const value = match[0];
      // Guard against zero-width matches (regex pathology) which would loop forever.
      if (value.length === 0) {
        re.lastIndex += 1;
        continue;
      }
      const start = match.index;
      const end = start + value.length;
      // Credit-card extra check: discard if luhn fails (heuristic guard).
      if (rule.kind === 'credit_card' && !looksLikeCardNumber(value)) continue;
      // Phone extra check: ensure at least 7 digits, skip pure punctuation.
      if (rule.kind === 'phone' && countDigits(value) < 7) continue;
      raw.push({
        kind: rule.kind,
        start,
        end,
        preview:
          rule.kind === 'email'
            ? maskEmail(value)
            : buildPreview(value, rule.previewLength),
      });
    }
  }
  return dedupeOverlap(raw);
}

/**
 * Redact PII in a piece of text and return both the redacted string and
 * the structured findings.
 *
 * Findings are returned in document order. The replacer never sees the
 * raw value, only the kind and index — to discourage misuse of the API
 * for sneaky logging.
 *
 * @example
 * const { redacted, findings } = redactPII("token=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa12345678");
 * // redacted: "token=[REDACTED:github_token]"
 */
export function redactPII(input: string, options: RedactPIIOptions = {}): RedactionResult {
  const { replacer = defaultReplacer } = options;
  const findings = detectPII(input, options);
  if (findings.length === 0) return { redacted: input, findings };
  let result = '';
  let cursor = 0;
  let i = 0;
  for (const f of findings) {
    result += input.slice(cursor, f.start);
    result += replacer(f.kind, i);
    cursor = f.end;
    i += 1;
  }
  result += input.slice(cursor);
  return { redacted: result, findings };
}

/**
 * Recursive variant for objects — every string leaf is passed through
 * `redactPII` and replaced by its redacted form. Non-string leaves are
 * left untouched. Cyclic structures are handled by tracking visited
 * objects with a `WeakSet`.
 *
 * @returns A pair containing a deep-cloned object with redacted strings
 * and the cumulative list of findings (with object paths in `details`
 * via `findings[i].preview` only — paths are intentionally not exposed
 * to avoid leaking the schema in log lines).
 */
export function redactPIIDeep<T>(value: T, options: RedactPIIOptions = {}): { value: T; findings: readonly PIIFinding[] } {
  const findings: PIIFinding[] = [];
  const visited = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const r = redactPII(v, options);
      findings.push(...r.findings);
      return r.redacted;
    }
    if (v === null || typeof v !== 'object') return v;
    if (visited.has(v as object)) return v;
    visited.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      out[k] = walk(child);
    }
    return out;
  };

  return { value: walk(value) as T, findings };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const head = local.length > 0 ? local[0] : '';
  return `${head}***${domain}`;
}

function countDigits(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) n += 1;
  }
  return n;
}

/** Luhn check for credit-card heuristic. */
function looksLikeCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const ch = digits.charCodeAt(i) - 48;
    if (ch < 0 || ch > 9) return false;
    let d = ch;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}
