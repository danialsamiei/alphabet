# Telemetry Schema (Non-PII, Aggregated)

## Standard Events

- `layer_selected`
- `consent_transition`
- `handshake_phase_timing`

## Allowed Fields

### `layer_selected`
- `event`
- `at` (epoch ms)
- `layer`
- `reasonCode`
- `source`

### `consent_transition`
- `event`
- `at` (epoch ms)
- `fromTier`
- `toTier`
- `fromState`
- `toState`
- `source`

### `handshake_phase_timing`
- `event`
- `at` (epoch ms)
- `phase`
- `durationMs`
- `source`

## Retention

- Raw in-memory event buffer in demo: **current session only** (max 500 events).
- Aggregates in demo UI: **current session only**.
- Recommended production retention for event-level rows: **7 days** max.
- Recommended retention for anonymous aggregates: **30 days**.

## Redaction Rules

- Never include free-text user input.
- Never include raw IP address, user agent string, or stable identifiers.
- Never include email, phone, name, exact geo, cookie IDs, ad IDs, or device fingerprints.
- `reasonCode` must come from an allow-list enum.
- Drop unknown keys before sink write.
