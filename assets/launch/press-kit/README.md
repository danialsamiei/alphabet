# Alphabet — Press Kit

> Everything a journalist, conference organiser, or partner needs to write
> about Alphabet without having to ask. Permanent canonical home:
> [`github.com/danialsamiei/alphabet/tree/main/assets/launch/press-kit`](https://github.com/danialsamiei/alphabet/tree/main/assets/launch/press-kit).

Last updated: 2026-04-29 (v1.0 launch).

---

## Quick facts

| Field                  | Value                                                                                                            |
| :--------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Project name**       | Alphabet (often styled "Alphabet 1.0 — danial.ai Edition")                                                       |
| **Persian wordmark**   | الفبای وب تو ("the alphabet of your web")                                                                       |
| **Type**               | Open-source TypeScript SDK (monorepo of five packages)                                                          |
| **License**            | MIT                                                                                                              |
| **Status**             | v1.0 — first stable public release (2026-04-29)                                                                  |
| **Maintainer**         | Danial Samiei                                                                                                    |
| **Affiliation**        | Alefba International AI Research & Development Program — [alef.ba](https://alef.ba)                              |
| **Repository**         | [github.com/danialsamiei/alphabet](https://github.com/danialsamiei/alphabet)                                     |
| **Website (planned)**  | [alphabet.alef.ba](https://alphabet.alef.ba)                                                                     |
| **Topic tags**         | privacy, web-sdk, adaptive-ui, consent, gdpr, react, typescript, edge, accessibility, i18n, RTL                  |

---

## Pitches at three lengths

Use whichever fits your word budget. All three are accurate against the
shipped v1.0 code; do not edit the technical claims (privacy posture, layer
count, consent ladder) without checking with the maintainer.

### 50 words

> **Alphabet** is an open-source, privacy-first TypeScript SDK that turns
> any website into a context-aware, multilingual, capability-adaptive
> experience without cookies, fingerprinting, or third-party calls. It
> reads only passive browser signals, enforces a four-tier consent ladder,
> and adapts the UI across five render layers. MIT-licensed.

### 150 words

> **Alphabet** (الفبای وب تو) is the first open-source SDK to make
> "context-aware web" possible without invasive tracking. Released today
> at v1.0 by the Alefba International AI Research & Development Program,
> it gives developers four small primitives — passive signal collection,
> a typed UI configuration, a four-tier monotonic consent ladder, and a
> normalized envelope for AI clients (Direct REST, MCP, A2A, encrypted QR
> handoff) — and a five-layer Adaptive Render system that automatically
> degrades from React Three Fiber through CSS 3D, Canvas 2D, semantic HTML,
> and a text-only ARIA mode. There are no cookies, no fingerprints, and no
> third-party calls. DNT and GPC always win. The result is a web that can
> finally speak the visitor's language, respect their device, and honour
> their privacy at the same time. MIT-licensed; available now on npm.

### 500 words

> **Alphabet 1.0 (danial.ai Edition)** is the first open-source SDK that
> makes a *context-aware web* possible without the tracking that has
> historically gone with personalization. Released today by **Danial
> Samiei** under the **Alefba International AI Research & Development
> Program**, Alphabet ships five npm packages (`@alphabet/core`,
> `@alphabet/api`, `@alphabet/ui`, `@alphabet/protocols`, `@alphabet/security`)
> and a complete reference demo, all under the MIT license.
>
> Most websites today force a binary choice: a static one-size-fits-all
> page that ignores the visitor entirely, or heavy client-side
> personalization built on cookies, fingerprints, and dark consent
> patterns. Alphabet provides a third path. It reads only **passive
> browser signals** — `Accept-Language`, IANA timezone, viewport, a WebGL
> probe, the network class, motion preferences, DNT, and GPC — and turns
> them into a **typed UI configuration**: locale, writing direction
> (including full RTL for Persian and Arabic), theme, and one of five
> Adaptive Render Layers ranging from a React Three Fiber immersive scene
> down to a text-only ARIA mode for screen readers and feature phones.
>
> The privacy story is not aspirational; it is enforced in code.
> `ConsentTierManager` is a state machine over four monotonic tiers
> (`NO_MEMORY` → `ANONYMOUS` → `CONSENTED` → `ENRICHED`) with explicit
> revoke and policy-version invalidation. DNT and GPC trigger automatic
> downgrade in code, not configuration; tier upgrades cannot override
> them. Differential-privacy primitives (Laplace, Gaussian,
> *k*-anonymity, append-only privacy budget ledger) are sampled from
> `crypto.getRandomValues` — never `Math.random()`. PII redaction,
> prompt-injection heuristics, output sanitization with a branded
> `SafeRender` type, and a memory-integrity guard with a static read ACL
> round out `@alphabet/security`. A self-attestation against OWASP LLM
> Top‑10 v1.1, GDPR Articles 5/7/13–14/17/25/32, and the NIST AI Risk
> Management Framework 1.0 ships in `docs/LAUNCH_SECURITY_REVIEW.md`.
>
> Alphabet is provider-neutral by design: `@alphabet/protocols` ships
> adapters for direct REST, the Model Context Protocol (MCP), the
> Agent-to-Agent (A2A) protocol, and AES-GCM-encrypted QR handoff for
> mobile-to-desktop session transfer — without bundling any specific
> LLM provider SDK. The base `@alphabet/ui` bundle is intentionally
> R3F-free (≤12 KB brotli, enforced in CI); the immersive layer loads
> lazily only when the decision engine selects it.
>
> Alphabet is part of a larger research programme at **alef.ba**
> exploring what a privacy-first, locally-rooted, internationally-useful
> web can look like. v1.0 is the first stable, production-ready cut of
> that programme. The roadmap (`docs/ROADMAP.md`) outlines the
> follow-on work: spatial-reality (XR) anchors, ethical pre-empting via
> Pulse v2, and a hosted intelligence layer.
>
> Available now on npm and at
> [alphabet.alef.ba](https://alphabet.alef.ba).

---

## Asset inventory

All assets live alongside this README in `assets/launch/`. Sizes shown are
file sizes on disk; SVGs scale to any DPR.

| File                                        | Format | Use case                                                   |
| :------------------------------------------ | :----- | :--------------------------------------------------------- |
| `assets/launch/og-card.svg`                 | SVG    | Open Graph (1200×630). Convert to PNG for `<meta og:image>`. |
| `assets/launch/twitter-card.svg`            | SVG    | X / Twitter "summary_large_image" (1600×900).               |
| `assets/launch/logo-animated.svg`           | SVG    | Animated logo. Honours `prefers-reduced-motion: reduce`.    |
| `assets/launch/wordmark.svg`                | SVG    | Horizontal wordmark for headers / banners.                  |
| `logo.png`                                  | PNG    | Square avatar / profile picture (220 px reference).         |
| `logo-small.png`                            | PNG    | Favicon / small in-line use.                                |

**Why SVG instead of GIF/MP4 for the animated logo?** Lossless, smaller
on the wire, and the only format that natively respects
`prefers-reduced-motion`. A high-fidelity GIF or MP4 marketing reel is
explicitly **not** part of v1.0 — that production should be done by a
designer, and the animated SVG here is the correct lossless reference.

### Brand palette

| Role        | Hex       | Notes                                       |
| :---------- | :-------- | :------------------------------------------ |
| Navy        | `#1c2432` | Primary background; from the existing logo. |
| Teal        | `#00d4c8` | Primary accent; "context" / interactive.    |
| Yellow      | `#ffd93d` | Secondary accent; "the alphabet" disc.      |
| Off-white   | `#f4f6f8` | Foreground on dark.                          |
| Muted slate | `#9aa3b2` | Captions / sub-headlines.                    |
| Warm white  | `#fff5b8` | Disc highlight only.                         |

### Typography

* **Headlines.** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` —
  intentionally OS-native so cards and badges render identically without
  shipping a webfont.
* **Numerics / code.** `ui-monospace, SFMono-Regular, Menlo, monospace`.
* **Persian / RTL.** Vazirmatn (already in use across the docs and demo).

---

## License & attribution

* **Software & docs.** MIT — see [`LICENSE`](../../../LICENSE).
* **Brand assets in this directory.** Released under MIT alongside the
  source. Attribution is appreciated ("Alphabet — alef.ba") but not
  required.
* **Logo.** Use freely in editorial coverage. Do not modify the disc-and-A
  glyph in ways that misrepresent the project's identity.

If you need an asset in a format not in this directory (PNG export of an
SVG, lossless WebP, transparent variant), open an issue against the
repository — we'll add it to the kit rather than passing a one-off.

---

## Suggested taglines

For headlines and chyrons, in order of preference:

1. **The Alphabet of Your Web.**
2. **A privacy-first, context-aware, adaptive web SDK.**
3. **Five render layers. Four consent tiers. Zero invasive tracking.**

Persian: *الفبای وب تو* (with the same hierarchy).

---

## Contact

* Maintainer: **Danial Samiei** — [github.com/danialsamiei](https://github.com/danialsamiei)
* Programme: **Alefba International AI Research & Development Program** — [alef.ba](https://alef.ba)
* Security disclosures: see [`SECURITY.md`](../../../SECURITY.md).
