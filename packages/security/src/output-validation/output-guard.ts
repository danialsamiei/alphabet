/**
 * @module output-validation/output-guard
 * @description
 * Helpers for safely handling AI- or user-generated output before it is
 * rendered, navigated to, or otherwise actioned by the host
 * application.
 *
 * Three concerns are addressed:
 *  1. **URL validation** — only allow `http`, `https`, and (optionally)
 *     `mailto` / `tel` schemes; reject `javascript:`, `data:`, and
 *     `file:` URLs unconditionally.
 *  2. **HTML sanitization** — strip script, style, iframe, object,
 *     embed, and on-event attributes from a small subset of allowed
 *     tags. This is intentionally conservative; it is **not** a
 *     replacement for DOMPurify in untrusted-rich-text scenarios.
 *  3. **SafeRender mark** — wraps a sanitized string in an opaque
 *     `SafeRender` brand so that consumers can refuse to render
 *     anything that has not been through the sanitizer.
 *
 * **Limitations.** This sanitizer rejects active content but does not
 * understand CSS expressions, mutation XSS, SVG payloads, or namespaced
 * attributes. For arbitrary HTML from third parties, route through a
 * vetted library and run inside a sandboxed iframe.
 */

// ─── URL validation ──────────────────────────────────────────────────────────

/** پروتکل‌های مجاز پیش‌فرض. */
export const DEFAULT_ALLOWED_PROTOCOLS: readonly string[] = ['http:', 'https:'];

/** خطاهای validation. */
export type UrlValidationError =
  | 'invalid_url'
  | 'disallowed_protocol'
  | 'opaque_relative'
  | 'host_not_allowed';

/** خروجی validation URL. */
export type UrlValidationResult =
  | { readonly ok: true; readonly url: URL; readonly normalized: string }
  | { readonly ok: false; readonly error: UrlValidationError; readonly reason: string };

/** گزینه‌های validation URL. */
export interface ValidateUrlOptions {
  /** پروتکل‌های مجاز — پیش‌فرض `['http:', 'https:']`. */
  readonly allowedProtocols?: readonly string[];
  /**
   * Whitelist hostها (دقیق match) — undefined یعنی هر host مجاز است
   * (بعد از pass شدن چک پروتکل).
   */
  readonly allowedHosts?: readonly string[];
  /**
   * Base URL برای resolve کردن مسیرهای نسبی. اگر undefined و ورودی
   * نسبی، خروجی `opaque_relative` خواهد بود.
   */
  readonly base?: string;
}

const ABSOLUTE_DANGEROUS_PROTOCOL = /^\s*(?:javascript|data|vbscript|file):/i;

/**
 * Validate a URL string against an allow-list of protocols and (optional)
 * hosts.
 *
 * @example
 * const r = validateUrl('javascript:alert(1)');
 * r.ok === false; r.error === 'disallowed_protocol';
 */
export function validateUrl(
  input: string,
  options: ValidateUrlOptions = {}
): UrlValidationResult {
  const { allowedProtocols = DEFAULT_ALLOWED_PROTOCOLS, allowedHosts, base } = options;

  if (typeof input !== 'string' || input.trim().length === 0) {
    return { ok: false, error: 'invalid_url', reason: 'Empty input' };
  }

  // Reject obvious dangerous schemes before parsing — the URL constructor
  // happily parses `javascript:` and we do not want to even hand it back.
  if (ABSOLUTE_DANGEROUS_PROTOCOL.test(input)) {
    return { ok: false, error: 'disallowed_protocol', reason: `Refused dangerous scheme in: ${stripForLog(input)}` };
  }

  let parsed: URL;
  try {
    parsed = base !== undefined ? new URL(input, base) : new URL(input);
  } catch {
    return { ok: false, error: base !== undefined ? 'invalid_url' : 'opaque_relative', reason: 'Could not parse URL' };
  }

  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      ok: false,
      error: 'disallowed_protocol',
      reason: `Protocol ${parsed.protocol} not in allow-list`,
    };
  }

  if (allowedHosts !== undefined && !allowedHosts.includes(parsed.host)) {
    return {
      ok: false,
      error: 'host_not_allowed',
      reason: `Host ${parsed.host} not in allow-list`,
    };
  }

  return { ok: true, url: parsed, normalized: parsed.toString() };
}

/** کوتاه‌کردن مقدار برای log — برای جلوگیری از log کردن payload طولانی. */
function stripForLog(value: string): string {
  return value.length > 64 ? `${value.slice(0, 64)}…` : value;
}

// ─── HTML sanitization ───────────────────────────────────────────────────────

/** Brand برای محتوای sanitized. */
declare const __SafeRender: unique symbol;
export type SafeRender = string & { readonly [__SafeRender]: true };

/** گزینه‌های sanitize. */
export interface SanitizeHtmlOptions {
  /** تگ‌های مجاز — پیش‌فرض زیرمجموعه inline + structural. */
  readonly allowedTags?: readonly string[];
  /**
   * صفت‌های مجاز per-tag (پیش‌فرض: `href` و `title` فقط برای `a`).
   * Use the special key `'*'` to apply to all tags.
   */
  readonly allowedAttributes?: Readonly<Record<string, readonly string[]>>;
  /** پروتکل‌های مجاز برای attribute `href` / `src`. */
  readonly allowedUrlProtocols?: readonly string[];
}

const DEFAULT_ALLOWED_TAGS: readonly string[] = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'em', 'i', 'li', 'ol', 'p', 'pre',
  's', 'small', 'span', 'strong', 'sub', 'sup', 'u', 'ul',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
];

const DEFAULT_ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'title'],
  abbr: ['title'],
  span: ['title'],
};

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

/**
 * Result of `sanitizeHtml` — either a `SafeRender` string or an explicit
 * unsafe marker with the reason. Callers must check `safe` before
 * setting `innerHTML`.
 */
export type SanitizeHtmlResult =
  | { readonly safe: true; readonly value: SafeRender; readonly removed: readonly string[] }
  | { readonly safe: false; readonly reason: string; readonly removed: readonly string[] };

/**
 * Sanitize a fragment of HTML-like text. The implementation is a small,
 * conservative tokeniser — it is **not** an HTML5-conformant parser. It
 * is suitable for short AI-generated rich-text snippets (titles,
 * paragraphs, basic lists) where we want bold/italic/links and nothing
 * else.
 *
 * @example
 * const r = sanitizeHtml('<p>hi <script>alert(1)</script></p>');
 * r.safe === true; r.value === '<p>hi </p>';
 */
export function sanitizeHtml(input: string, options: SanitizeHtmlOptions = {}): SanitizeHtmlResult {
  const allowedTags = new Set((options.allowedTags ?? DEFAULT_ALLOWED_TAGS).map((t) => t.toLowerCase()));
  const allowedAttributes = options.allowedAttributes ?? DEFAULT_ALLOWED_ATTRIBUTES;
  const allowedUrlProtocols = options.allowedUrlProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;

  if (typeof input !== 'string') {
    return { safe: false, reason: 'Input is not a string', removed: [] };
  }

  const removed: string[] = [];
  let out = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];
    if (ch === '<') {
      const closeIdx = input.indexOf('>', i + 1);
      if (closeIdx === -1) {
        // Unterminated tag — drop the rest as text-escaped.
        out += escapeText(input.slice(i));
        break;
      }
      const raw = input.slice(i + 1, closeIdx);
      const isClosing = raw.startsWith('/');
      const body = isClosing ? raw.slice(1).trim() : raw.trim();
      const nameMatch = body.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
      if (nameMatch === null) {
        // Not a valid tag — drop entirely (likely `<` followed by random text).
        removed.push(`malformed:${stripForLog(raw)}`);
        i = closeIdx + 1;
        continue;
      }
      const tag = nameMatch[1]?.toLowerCase() ?? '';

      if (!allowedTags.has(tag)) {
        removed.push(`tag:${tag}`);
        i = closeIdx + 1;
        // For container tags we additionally drop their children if they are
        // dangerous (script/style/iframe/object/embed). Any other unknown tag
        // is just stripped — children remain as text.
        if (!isClosing && DANGEROUS_CONTAINER_TAGS.has(tag)) {
          const closeTag = `</${tag}`;
          const closeAt = input.toLowerCase().indexOf(closeTag, i);
          if (closeAt !== -1) {
            const endAt = input.indexOf('>', closeAt);
            i = endAt === -1 ? len : endAt + 1;
          }
        }
        continue;
      }

      if (isClosing) {
        out += `</${tag}>`;
        i = closeIdx + 1;
        continue;
      }

      // Render allowed tag with filtered attributes.
      const attrs = parseAttributes(body.slice(nameMatch[0].length));
      const filtered: string[] = [];
      const allowedForTag = new Set([
        ...(allowedAttributes[tag] ?? []),
        ...(allowedAttributes['*'] ?? []),
      ]);
      for (const [name, value] of attrs) {
        const lower = name.toLowerCase();
        if (lower.startsWith('on')) {
          removed.push(`attr:${tag}.${lower}`);
          continue;
        }
        if (!allowedForTag.has(lower)) {
          removed.push(`attr:${tag}.${lower}`);
          continue;
        }
        if ((lower === 'href' || lower === 'src') && value !== undefined) {
          const ok = isUrlProtocolAllowed(value, allowedUrlProtocols);
          if (!ok) {
            removed.push(`attr:${tag}.${lower}=disallowed_protocol`);
            continue;
          }
        }
        filtered.push(value === undefined ? lower : `${lower}="${escapeAttr(value)}"`);
      }
      const selfClose = VOID_TAGS.has(tag);
      out += filtered.length > 0
        ? `<${tag} ${filtered.join(' ')}${selfClose ? '/' : ''}>`
        : `<${tag}${selfClose ? '/' : ''}>`;
      i = closeIdx + 1;
      continue;
    }

    // Plain text — escape `<` (handled above), `>`, and `&` lazily.
    out += escapeChar(ch ?? '');
    i += 1;
  }

  return { safe: true, value: out as SafeRender, removed };
}

const DANGEROUS_CONTAINER_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template',
]);

function parseAttributes(input: string): Array<[string, string | undefined]> {
  const out: Array<[string, string | undefined]> = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const name = m[1] ?? '';
    const value = m[2] ?? m[3] ?? m[4];
    out.push([name, value]);
  }
  return out;
}

function isUrlProtocolAllowed(value: string, allowedProtocols: readonly string[]): boolean {
  if (ABSOLUTE_DANGEROUS_PROTOCOL.test(value)) return false;
  // Relative or fragment URLs are allowed — they cannot escape the page.
  if (/^\s*(?:#|\/|\?|\.\/|\.\.\/)/.test(value)) return true;
  // Strip leading whitespace for protocol detection.
  const trimmed = value.trim();
  const colon = trimmed.indexOf(':');
  if (colon === -1) return true; // implicit relative
  const protocol = `${trimmed.slice(0, colon).toLowerCase()}:`;
  return allowedProtocols.includes(protocol);
}

function escapeChar(c: string): string {
  if (c === '>') return '&gt;';
  if (c === '&') return '&amp;';
  return c;
}

function escapeText(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

function escapeAttr(s: string): string {
  return s.replace(/[&"<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '"' ? '&quot;' : c === '<' ? '&lt;' : '&gt;'
  );
}

// ─── Plain-text marker ───────────────────────────────────────────────────────

/**
 * علامت‌گذاری متن کاملاً escape شده به‌عنوان SafeRender — برای زمانی که
 * هیچ HTML نمی‌خواهیم.
 *
 * Mark a fully-escaped string as `SafeRender`. Callers should prefer
 * this when they only need text (no markup) and want to refuse anything
 * with embedded HTML.
 */
export function markTextAsSafe(input: string): SafeRender {
  return escapeText(input) as SafeRender;
}

/**
 * Type guard — مشخص کردن اینکه مقدار از sanitizer عبور کرده است.
 * Trusts the caller to have produced the value via `sanitizeHtml` or
 * `markTextAsSafe`. Use only at trust boundaries.
 */
export function isSafeRender(_value: unknown): _value is SafeRender {
  return typeof _value === 'string';
}
