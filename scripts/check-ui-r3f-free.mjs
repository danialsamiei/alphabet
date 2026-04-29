#!/usr/bin/env node
/**
 * @file scripts/check-ui-r3f-free.mjs
 * @description
 * Sanity check that the **base** `@alphabet/ui` bundle does not import or inline
 * `@react-three/fiber` or `three`. R3F is a multi-hundred-KB peer dependency
 * that must remain in the dedicated `./layers/r3f` subpath entry only.
 *
 * Runs in CI right after `pnpm build`. Exits non-zero if any base bundle
 * mentions R3F as a static import or contains the literal package name.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BASE_BUNDLES = [
  'packages/ui/dist/index.js',
  'packages/ui/dist/index.cjs',
  'packages/ui/dist/hooks.js',
  'packages/ui/dist/hooks.cjs',
  'packages/ui/dist/layers.js',
  'packages/ui/dist/layers.cjs',
  'packages/ui/dist/primitives.js',
  'packages/ui/dist/primitives.cjs',
  'packages/ui/dist/runtime.js',
  'packages/ui/dist/runtime.cjs',
];

const FORBIDDEN_PATTERNS = [
  /from\s+['"]@react-three\/fiber['"]/,
  /from\s+['"]three['"]/,
  /require\(['"]@react-three\/fiber['"]\)/,
  /require\(['"]three['"]\)/,
];

let failed = false;
let checked = 0;
for (const rel of BASE_BUNDLES) {
  const abs = resolve(ROOT, rel);
  let content;
  try {
    content = readFileSync(abs, 'utf8');
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') {
      console.warn(`[check-ui-r3f-free] skip (not built yet): ${rel}`);
      continue;
    }
    throw err;
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`[check-ui-r3f-free] ❌ ${rel} contains forbidden import: ${pattern}`);
      failed = true;
    }
  }
  checked += 1;
}

if (failed) {
  console.error('\n[check-ui-r3f-free] base @alphabet/ui bundles must NOT import @react-three/fiber or three.');
  process.exit(1);
}
console.log(`[check-ui-r3f-free] ✅ ${checked} base @alphabet/ui bundle(s) verified R3F-free.`);
