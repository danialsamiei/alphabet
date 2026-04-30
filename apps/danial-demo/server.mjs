/**
 * @file server.mjs
 * @description
 * Local LLM relay for the Alphabet demo. Keeps provider API keys on the
 * server and exposes one browser-safe endpoint: POST /api/llm/chat.
 *
 * Supported providers:
 * - github  -> https://models.github.ai/inference/chat/completions
 * - openai  -> https://api.openai.com/v1/chat/completions
 * - openrouter -> https://openrouter.ai/api/v1/chat/completions
 */

import { createServer } from 'node:http';

const PORT = Number.parseInt(process.env.PORT ?? '8790', 10);
const MAX_BODY_BYTES = 64 * 1024;

const PROVIDERS = {
  github: {
    upstream: 'https://models.github.ai/inference/chat/completions',
    tokenEnv: 'GITHUB_TOKEN',
    allowedModels: (process.env.GITHUB_ALLOWED_MODELS ?? 'openai/gpt-4o-mini,openai/gpt-4o').split(',').map((x) => x.trim()).filter(Boolean),
  },
  openai: {
    upstream: 'https://api.openai.com/v1/chat/completions',
    tokenEnv: 'OPENAI_API_KEY',
    allowedModels: (process.env.OPENAI_ALLOWED_MODELS ?? 'gpt-4o-mini,gpt-4.1-mini').split(',').map((x) => x.trim()).filter(Boolean),
  },
  openrouter: {
    upstream: 'https://openrouter.ai/api/v1/chat/completions',
    tokenEnv: 'OPENROUTER_API_KEY',
    allowedModels: (process.env.OPENROUTER_ALLOWED_MODELS ?? 'openai/gpt-4o-mini,anthropic/claude-3.5-sonnet').split(',').map((x) => x.trim()).filter(Boolean),
  },
};

function replyJson(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    replyJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/llm/chat') {
    replyJson(res, 404, { error: 'not_found' });
    return;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      replyJson(res, 413, { error: 'payload_too_large' });
      return;
    }
    chunks.push(chunk);
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    replyJson(res, 400, { error: 'invalid_json' });
    return;
  }

  const providerId = typeof parsed.provider === 'string' ? parsed.provider : 'github';
  const provider = PROVIDERS[providerId];
  if (!provider) {
    replyJson(res, 400, { error: 'unsupported_provider' });
    return;
  }

  const token = process.env[provider.tokenEnv];
  if (!token) {
    replyJson(res, 500, { error: `${provider.tokenEnv.toLowerCase()}_missing` });
    return;
  }

  if (!provider.allowedModels.includes(parsed.model)) {
    replyJson(res, 400, { error: 'model_not_allowed', allowedModels: provider.allowedModels });
    return;
  }

  const payload = {
    model: parsed.model,
    messages: parsed.messages,
    temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.3,
    max_tokens: typeof parsed.max_tokens === 'number' ? parsed.max_tokens : 300,
  };

  try {
    const upstream = await fetch(provider.upstream, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    res.end(text);
  } catch (error) {
    replyJson(res, 502, { error: 'upstream_unreachable', detail: error instanceof Error ? error.message : 'unknown' });
  }
}).listen(PORT, () => {
  console.log(`[alphabet demo relay] listening on http://localhost:${PORT}`);
  console.log('[alphabet demo relay] endpoint: POST /api/llm/chat');
  console.log(`[alphabet demo relay] providers: ${Object.keys(PROVIDERS).join(', ')}`);
});
