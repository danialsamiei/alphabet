#!/usr/bin/env node
/**
 * @file scripts/bundle-visualizer.mjs
 * @description
 * Post-build bundle visualizer for the public Alphabet packages. Walks the
 * already-emitted `dist` JavaScript artifacts under each `packages/<name>/`
 * (which Vite builds with sourcemaps), computes raw / gzip / brotli sizes,
 * and emits two artifacts to `bundle-report/`:
 *
 *   1. `bundle-report/summary.json` — machine-readable size table.
 *   2. `bundle-report/index.html`   — typographic treemap-ish HTML report
 *                                     suitable for upload as a CI artifact.
 *
 * This is intentionally a zero-dependency Node script. We do not add
 * `rollup-plugin-visualizer` because that would require touching every
 * package's `vite.config.ts`; the additive script approach keeps the build
 * graph unchanged while still surfacing per-file weight in CI.
 *
 * Run: `node scripts/bundle-visualizer.mjs` (after `pnpm build`).
 * Exit code is always `0` unless a target package has no `dist/`. CI uses
 * the report for visibility, not as a gate (size-limit remains the gate).
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'bundle-report');

/** Packages whose dist/ we walk. Aligned with the public surface area. */
const TARGET_PACKAGES = [
  '@alphabet/core',
  '@alphabet/api',
  '@alphabet/ui',
  '@alphabet/protocols',
  '@alphabet/security',
];

/** Map a package name to its on-disk directory. */
const PACKAGE_DIRS = {
  '@alphabet/core': 'packages/core',
  '@alphabet/api': 'packages/api',
  '@alphabet/ui': 'packages/ui',
  '@alphabet/protocols': 'packages/protocols',
  '@alphabet/security': 'packages/security',
};

/**
 * Recursively list files matching a predicate.
 * @param {string} dir
 * @param {(p: string) => boolean} predicate
 * @returns {string[]}
 */
function walk(dir, predicate) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

/**
 * @param {string} abs
 * @returns {{ raw: number, gzip: number, brotli: number }}
 */
function measure(abs) {
  const buf = readFileSync(abs);
  return {
    raw: buf.byteLength,
    gzip: gzipSync(buf).byteLength,
    brotli: brotliCompressSync(buf, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    }).byteLength,
  };
}

/** @param {number} bytes */
function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

mkdirSync(OUT_DIR, { recursive: true });

/**
 * @typedef {Object} FileEntry
 * @property {string} file        - Path relative to the package root.
 * @property {number} raw
 * @property {number} gzip
 * @property {number} brotli
 *
 * @typedef {Object} PackageEntry
 * @property {string} name
 * @property {boolean} built
 * @property {FileEntry[]} files
 * @property {{ raw: number, gzip: number, brotli: number }} totals
 */

/** @type {PackageEntry[]} */
const summary = [];

for (const pkg of TARGET_PACKAGES) {
  const dir = resolve(ROOT, PACKAGE_DIRS[pkg], 'dist');
  let built = true;
  let files = [];
  try {
    statSync(dir);
  } catch {
    built = false;
  }
  if (built) {
    const jsFiles = walk(dir, (p) => /\.(js|cjs)$/.test(p) && !/\.map$/.test(p));
    files = jsFiles
      .map((abs) => ({
        file: relative(resolve(ROOT, PACKAGE_DIRS[pkg]), abs),
        ...measure(abs),
      }))
      .sort((a, b) => b.brotli - a.brotli);
  }
  const totals = files.reduce(
    (acc, f) => ({
      raw: acc.raw + f.raw,
      gzip: acc.gzip + f.gzip,
      brotli: acc.brotli + f.brotli,
    }),
    { raw: 0, gzip: 0, brotli: 0 }
  );
  summary.push({ name: pkg, built, files, totals });
}

writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

// ---------------------------------------------------------------------------
// HTML report — single self-contained file. No external assets; no JS deps.
// ---------------------------------------------------------------------------

/**
 * Render one row.
 * @param {string} label
 * @param {number} raw
 * @param {number} gzip
 * @param {number} brotli
 * @param {number} maxBrotli
 * @param {string} extraClass
 */
function row(label, raw, gzip, brotli, maxBrotli, extraClass = '') {
  const widthPct = maxBrotli > 0 ? Math.max(2, Math.round((brotli / maxBrotli) * 100)) : 0;
  return `
    <tr class="${extraClass}">
      <td class="file"><code>${label}</code></td>
      <td class="num">${fmt(raw)}</td>
      <td class="num">${fmt(gzip)}</td>
      <td class="num">${fmt(brotli)}</td>
      <td class="bar"><span style="width:${widthPct}%"></span></td>
    </tr>`;
}

const allBrotli = summary.flatMap((p) => p.files.map((f) => f.brotli));
const maxBrotli = allBrotli.length > 0 ? Math.max(...allBrotli) : 1;

const sectionsHtml = summary
  .map((pkg) => {
    if (!pkg.built) {
      return `
        <section>
          <h2>${pkg.name} <span class="warn">(not built — run <code>pnpm build</code>)</span></h2>
        </section>`;
    }
    const rowsHtml = pkg.files.map((f) => row(f.file, f.raw, f.gzip, f.brotli, maxBrotli)).join('');
    const totalRow = row('TOTAL', pkg.totals.raw, pkg.totals.gzip, pkg.totals.brotli, maxBrotli, 'total');
    return `
      <section>
        <h2>${pkg.name}</h2>
        <table>
          <thead>
            <tr><th>File</th><th>Raw</th><th>gzip</th><th>brotli</th><th></th></tr>
          </thead>
          <tbody>${rowsHtml}${totalRow}</tbody>
        </table>
      </section>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Alphabet — Bundle visualizer</title>
<style>
  :root {
    --fg: #1c2432;
    --bg: #ffffff;
    --muted: #6b7280;
    --accent: #00d4c8;
    --accent-2: #ffd93d;
    --row: #f4f6f8;
    --total: #e6fbf9;
    --warn: #b45309;
  }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #f4f6f8; --bg: #0f1620; --muted: #9aa3b2; --row: #161f2c; --total: #0e2926; }
  }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         color: var(--fg); background: var(--bg); margin: 0; padding: 32px; }
  header { max-width: 960px; margin: 0 auto 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .sub { color: var(--muted); }
  main { max-width: 960px; margin: 0 auto; }
  section { margin-bottom: 28px; }
  h2 { margin: 0 0 8px; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-weight: 600; color: var(--muted);
             border-bottom: 1px solid var(--muted); padding: 6px 8px; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid color-mix(in srgb, var(--muted) 25%, transparent); }
  tr:hover td { background: var(--row); }
  .file code { font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bar { width: 32%; }
  .bar span { display: block; height: 8px; background: var(--accent); border-radius: 4px; }
  tr.total td { font-weight: 600; background: var(--total); }
  tr.total .bar span { background: var(--accent-2); }
  .warn { color: var(--warn); font-weight: 500; }
  footer { max-width: 960px; margin: 32px auto 0; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
  <header>
    <h1>Alphabet — Bundle visualizer</h1>
    <p class="sub">
      Per-file raw / gzip / brotli sizes for the public Alphabet packages.
      Generated post-build by <code>scripts/bundle-visualizer.mjs</code>.
      Bars are scaled to the largest brotli-compressed file in this run.
      Authoritative size budgets live in <code>.size-limit.json</code>; this
      report is for visibility, not enforcement.
    </p>
    <p class="sub">Generated: ${new Date().toISOString()}</p>
  </header>
  <main>
    ${sectionsHtml}
  </main>
  <footer>
    <p>Report generated by <code>scripts/bundle-visualizer.mjs</code>. See <code>docs/RELEASE.md</code> for size policy.</p>
  </footer>
</body>
</html>`;

writeFileSync(resolve(OUT_DIR, 'index.html'), html);

// Console summary so CI logs are useful even without the artifact.
console.log('Alphabet bundle report');
console.log('======================');
for (const pkg of summary) {
  if (!pkg.built) {
    console.log(`  ${pkg.name}: not built`);
    continue;
  }
  console.log(
    `  ${pkg.name}: ${pkg.files.length} file(s), total brotli ${fmt(pkg.totals.brotli)} (raw ${fmt(pkg.totals.raw)})`
  );
}
console.log(`Wrote ${resolve(OUT_DIR, 'summary.json')}`);
console.log(`Wrote ${resolve(OUT_DIR, 'index.html')}`);
