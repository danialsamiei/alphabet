/**
 * @file apps/docs/next.config.mjs
 * @description
 * Next.js configuration wired with Nextra v3. The Nextra plugin handles all
 * MDX compilation; we only configure Next-level options here.
 *
 * Static export: `next build` (Next 15) emits `out/` directly when
 * `output: 'export'` is set. The `docs.yml` workflow uploads `out/` as the
 * Pages artifact.
 *
 * Base path: when deploying to a project page (`<user>.github.io/alphabet/`)
 * we need a `basePath`. When deploying to a custom apex domain
 * (`alphabet.alef.ba`) we want it empty. Both are toggled by
 * `DOCS_BASE_PATH`, which the workflow sets explicitly.
 */
import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
});

const basePath = process.env.DOCS_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  // GitHub Pages serves static files; disable the image optimizer.
  images: { unoptimized: true },
  basePath,
  // assetPrefix matches basePath so static assets resolve under a project page.
  assetPrefix: basePath,
};

export default withNextra(nextConfig);
