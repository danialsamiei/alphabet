/**
 * @file output-guard.test.ts
 * @description Tests for URL validation and HTML sanitization.
 */

import { describe, it, expect } from 'vitest';
import { validateUrl, sanitizeHtml, markTextAsSafe } from './output-guard.js';

describe('validateUrl', () => {
  it('accepts an http URL', () => {
    const r = validateUrl('http://example.com/page');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.protocol).toBe('http:');
  });

  it('accepts an https URL', () => {
    const r = validateUrl('https://example.com/');
    expect(r.ok).toBe(true);
  });

  it('rejects javascript: URLs', () => {
    const r = validateUrl('javascript:alert(1)');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('disallowed_protocol');
  });

  it('rejects javascript: URLs with surrounding whitespace', () => {
    const r = validateUrl('  javascript:alert(1)  ');
    expect(r.ok).toBe(false);
  });

  it('rejects data: URLs', () => {
    const r = validateUrl('data:text/html,<script>alert(1)</script>');
    expect(r.ok).toBe(false);
  });

  it('rejects file: URLs', () => {
    const r = validateUrl('file:///etc/passwd');
    expect(r.ok).toBe(false);
  });

  it('rejects relative URLs without a base', () => {
    const r = validateUrl('/path');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('opaque_relative');
  });

  it('resolves relative URLs against an explicit base', () => {
    const r = validateUrl('/path', { base: 'https://example.com' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe('https://example.com/path');
  });

  it('honours allowedHosts', () => {
    const r = validateUrl('https://evil.example/x', { allowedHosts: ['good.example'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('host_not_allowed');
  });

  it('honours custom allowedProtocols', () => {
    const r = validateUrl('mailto:alice@example.com', {
      allowedProtocols: ['mailto:'],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects empty strings', () => {
    const r = validateUrl('');
    expect(r.ok).toBe(false);
  });
});

describe('sanitizeHtml — strips active content', () => {
  it('removes <script> blocks and their contents', () => {
    const r = sanitizeHtml('<p>hi <script>alert(1)</script></p>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value.includes('script')).toBe(false);
      expect(r.value.includes('alert')).toBe(false);
    }
  });

  it('removes <iframe> blocks', () => {
    const r = sanitizeHtml('<p>x</p><iframe src="https://evil.example"></iframe>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value.includes('iframe')).toBe(false);
    }
  });

  it('removes on* event handlers', () => {
    const r = sanitizeHtml('<a href="https://example.com" onclick="alert(1)">x</a>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value.includes('onclick')).toBe(false);
      expect(r.value.includes('href')).toBe(true);
    }
  });

  it('removes javascript: hrefs', () => {
    const r = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value.includes('javascript:')).toBe(false);
      expect(r.value.includes('href')).toBe(false);
    }
  });

  it('keeps allowed tags and attributes', () => {
    const r = sanitizeHtml('<p>hello <strong>world</strong> <a href="https://x.io">link</a></p>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value).toContain('<p>');
      expect(r.value).toContain('<strong>');
      expect(r.value).toContain('href="https://x.io"');
    }
  });

  it('escapes stray angle brackets in text', () => {
    const r = sanitizeHtml('a > b & c');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value).toBe('a &gt; b &amp; c');
    }
  });

  it('reports removed items in `removed` array', () => {
    const r = sanitizeHtml('<a onclick="x" href="javascript:1">y</a>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.removed.some((s) => s.includes('onclick'))).toBe(true);
    }
  });

  it('rejects non-string input', () => {
    const r = sanitizeHtml(undefined as unknown as string);
    expect(r.safe).toBe(false);
  });

  it('drops disallowed but harmless tags (e.g. <font>)', () => {
    const r = sanitizeHtml('<font color="red">hi</font>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.value.includes('<font')).toBe(false);
    }
  });
});

describe('markTextAsSafe', () => {
  it('escapes HTML metacharacters', () => {
    const v = markTextAsSafe('<script>x</script>');
    expect(String(v)).toBe('&lt;script&gt;x&lt;/script&gt;');
  });
});
