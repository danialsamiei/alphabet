// @ts-check
/**
 * @file server.mjs
 * @description
 * Minimal zero-dependency Node proxy for the Danial Samiei demo site.
 *
 * Why this exists
 * ---------------
 * The page calls `POST /api/assistant` to talk to the GitHub Models
 * inference API. The browser must NEVER see the GitHub token, so we
 * proxy here, attach `Authorization: Bearer $GITHUB_TOKEN` server-side,
 * and forward the request to `https://models.github.ai/inference/...`.
 *
 * Run it with:
 *   GITHUB_TOKEN=ghp_... node apps/danial-site/server.mjs
 * or:
 *   GITHUB_TOKEN=ghp_... pnpm --filter @awaf/danial-site dev:proxy
 *
 * Vite (`pnpm dev`) is configured to forward `/api/assistant` here
 * via its `server.proxy` setting (see vite.config.ts).
 *
 * No external HTTP framework is used so the demo stays buildable
 * inside the AWAF monorepo without adding new dependencies.
 */

import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const UPSTREAM =
  process.env.GITHUB_MODELS_ENDPOINT ??
  'https://models.github.ai/inference/chat/completions';
const ALLOWED_MODELS = (process.env.ALLOWED_MODELS ?? 'openai/gpt-4o-mini,openai/gpt-4o')
  .split(',')
  .map((m) => m.trim())
  .filter((m) => m.length > 0);
const MAX_BODY_BYTES = 32 * 1024; // 32 KiB — chat payloads are small.

if (TOKEN === '') {
  console.warn(
    '[danial-site proxy] WARNING: GITHUB_TOKEN is not set. ' +
      'Requests will be forwarded without auth and GitHub Models will reject them.'
  );
}

const server = http.createServer((req, res) => {
  // CORS for local dev — Vite proxies same-origin so this is mostly
  // for direct curl testing.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hasToken: TOKEN !== '' }));
    return;
  }

  if (req.url !== '/api/assistant' || req.method !== 'POST') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  collectBody(req, MAX_BODY_BYTES)
    .then(async (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
        return;
      }

      // Allow-list of models to prevent the proxy being abused as
      // a generic GitHub Models gateway.
      if (typeof parsed.model !== 'string' || !ALLOWED_MODELS.includes(parsed.model)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'model_not_allowed',
            allowed: ALLOWED_MODELS,
          })
        );
        return;
      }

      try {
        const upstream = await fetch(UPSTREAM, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${TOKEN}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(parsed),
        });

        const text = await upstream.text();
        res.writeHead(upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
        });
        res.end(text);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'upstream_error';
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'upstream_error', detail: message }));
      }
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'bad_request';
      const status = message === 'payload_too_large' ? 413 : 400;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    });
});

/**
 * @param {http.IncomingMessage} req
 * @param {number} max
 * @returns {Promise<string>}
 */
function collectBody(req, max) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > max) {
        req.destroy();
        reject(new Error('payload_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`[danial-site proxy] listening on http://localhost:${PORT}`);
  console.log(`[danial-site proxy] forwarding /api/assistant -> ${UPSTREAM}`);
  console.log(`[danial-site proxy] allowed models: ${ALLOWED_MODELS.join(', ')}`);
});
