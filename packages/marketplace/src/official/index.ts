/**
 * @module @alphabet/marketplace/official
 * @description
 * The first set of **official** marketplace entries shipped by the
 * Alphabet core team. Each manifest here is a constant and is trusted
 * to set `official: true`; consumer-published manifests cannot do so
 * because their `id` will not match the reserved `@alphabet/official:`
 * prefix.
 *
 * These manifests describe components and adapters that already ship
 * inside this monorepo (e.g. `@alphabet/ui`'s `LayerSelector`); the
 * marketplace package does not re-bundle them. The `entry` field is a
 * regular npm specifier so any host can resolve it.
 */

import type {
  ComponentManifest,
  ProtocolAdapterManifest,
  MarketplaceManifest,
} from '../types.js';

const ALPHABET_TEAM = [
  { id: 'alphabet-core', displayName: 'Alphabet Core Team' },
] as const;

/**
 * `<ConsentBanner />` — Tier-aware, RTL-safe consent UI shipped from
 * `@alphabet/ui`. Works in Layers 4 and 5 with no JS-driven motion.
 */
export const consentBannerManifest: ComponentManifest = {
  id: '@alphabet/official:consent-banner',
  kind: 'component',
  version: '1.0.0',
  title: 'Consent Banner',
  description:
    'Tier-aware, RTL-safe, AA-contrast consent banner. Honours DNT/GPC by auto-downgrading to Tier 0 with no persistence.',
  maintainers: [...ALPHABET_TEAM],
  license: 'MIT',
  official: true,
  homepage: 'https://github.com/danialsamiei/alphabet',
  repository: 'https://github.com/danialsamiei/alphabet',
  tags: ['consent', 'a11y-AA', 'rtl', 'reduced-motion-safe'],
  supportedLayers: [2, 3, 4, 5],
  capabilities: ['consent-grant', 'consent-revoke', 'dnt-aware'],
  entry: '@alphabet/ui#ConsentBanner',
  privacy: {
    requiredConsentTier: 0,
    respectsDoNotTrack: true,
    collectsNoPii: true,
    localOnly: true,
    memoryDomainsRead: [],
    memoryDomainsWritten: [],
  },
};

/**
 * `LayerSelector` — pure-capability detection that picks a layer
 * (1–5) and caches the result in `sessionStorage`. No personalisation.
 */
export const layerSelectorManifest: ComponentManifest = {
  id: '@alphabet/official:layer-selector',
  kind: 'component',
  version: '1.0.0',
  title: 'Layer Selector',
  description:
    'Capability-based renderer that picks one of the 5 UI degradation layers from device hints alone (WebGL, viewport, prefers-reduced-motion, hardwareConcurrency).',
  maintainers: [...ALPHABET_TEAM],
  license: 'MIT',
  official: true,
  tags: ['adaptive', 'degradation', 'capabilities'],
  supportedLayers: [1, 2, 3, 4, 5],
  capabilities: ['layer-decide', 'reduced-motion-respect', 'session-cache'],
  entry: '@alphabet/ui#LayerSelector',
  privacy: {
    requiredConsentTier: 1,
    respectsDoNotTrack: true,
    collectsNoPii: true,
    localOnly: true,
    memoryDomainsRead: ['site_specific'],
    memoryDomainsWritten: ['site_specific'],
  },
};

/**
 * `LanguageNegotiator` — three-locale negotiation from
 * `Accept-Language`, timezone, and explicit user choice. Cultural
 * RTL detection only; no IP geolocation.
 */
export const languageNegotiatorManifest: ComponentManifest = {
  id: '@alphabet/official:language-negotiator',
  kind: 'component',
  version: '1.0.0',
  title: 'Language Negotiator',
  description:
    'Three-locale negotiation that honours user choice over coarse signals; emits a structured suggestion list with confidences.',
  maintainers: [...ALPHABET_TEAM],
  license: 'MIT',
  official: true,
  tags: ['i18n', 'rtl', 'locale'],
  supportedLayers: [1, 2, 3, 4, 5],
  capabilities: ['locale-detect', 'locale-suggest', 'rtl-aware'],
  entry: '@alphabet/core#LanguageNegotiator',
  privacy: {
    requiredConsentTier: 0,
    respectsDoNotTrack: true,
    collectsNoPii: true,
    localOnly: true,
    memoryDomainsRead: [],
    memoryDomainsWritten: [],
  },
};

/**
 * `MCPAdapter` — Model Context Protocol bridge already shipped in
 * `@alphabet/protocols`. Read-only resource discovery by default.
 */
export const mcpAdapterManifest: ProtocolAdapterManifest = {
  id: '@alphabet/official:mcp-adapter',
  kind: 'protocol-adapter',
  version: '1.0.0',
  title: 'MCP Adapter',
  description:
    'Anthropic Model Context Protocol bridge. Exposes Alphabet visitor context, memory, and Technology Pulse as MCP resources and tools.',
  maintainers: [...ALPHABET_TEAM],
  license: 'MIT',
  official: true,
  tags: ['protocol', 'mcp', 'ai'],
  protocol: 'mcp',
  capabilities: ['resources', 'tools', 'prompts'],
  entry: '@alphabet/protocols#MCPAdapter',
  privacy: {
    requiredConsentTier: 1,
    respectsDoNotTrack: true,
    collectsNoPii: true,
    localOnly: false,
    memoryDomainsRead: ['general', 'tech_pulse'],
    memoryDomainsWritten: [],
  },
};

/** Bundle of every official manifest, ordered by id for deterministic seed. */
export const OFFICIAL_MANIFESTS: readonly MarketplaceManifest[] = [
  consentBannerManifest,
  languageNegotiatorManifest,
  layerSelectorManifest,
  mcpAdapterManifest,
].slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
