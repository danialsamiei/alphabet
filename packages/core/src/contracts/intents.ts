/**
 * @module contracts/intents
 * @description
 * Two distinct intent vocabularies in Alphabet, kept separate so that "what
 * is the visitor here for?" (DomainIntent) does not get mixed with
 * "which UI affordance did the visitor click?" (SuggestionActionIntent).
 *
 * Historical note: the original `IntentType` exported from
 * `@alphabet/core/types/base` mixed these two concepts. It is preserved as
 * a deprecated alias for backwards compatibility — new code should use
 * {@link DomainIntent} for high-level visitor purpose and
 * {@link SuggestionActionIntent} for UI suggestion chips.
 */

// ─── Domain Intent (high-level visitor purpose) ──────────────────────────────

/**
 * Domain-level intent — what is the visitor here for?
 *
 * Used by intent detection on the server side to classify a visitor's
 * session purpose. Stable across UI redesigns.
 *
 * - `technology` — interest in technology/innovation content
 * - `collaboration` — looking to collaborate or hire
 * - `class_notes` — accessing educational material
 * - `philosophy` — philosophical or reflective exploration
 * - `personal` — personal communication with the site owner
 * - `explore` — undirected exploration
 */
export type DomainIntent =
  | 'technology'
  | 'collaboration'
  | 'class_notes'
  | 'philosophy'
  | 'personal'
  | 'explore';

/** All valid {@link DomainIntent} values, in declaration order. */
export const DOMAIN_INTENTS: readonly DomainIntent[] = [
  'technology',
  'collaboration',
  'class_notes',
  'philosophy',
  'personal',
  'explore',
] as const;

// ─── Suggestion Action Intent (UI affordance) ────────────────────────────────

/**
 * UI/action intent — what does this suggestion *do* if the visitor
 * activates it?
 *
 * Used to render suggestion chips and decide whether the action requires
 * a consent prompt. Distinct from {@link DomainIntent} because it
 * describes UI behaviour, not visitor purpose.
 *
 * - `explore` — open an exploratory surface (also overlaps with DomainIntent)
 * - `learn` — open a learning surface
 * - `compare` — compare two or more entities
 * - `contact` — initiate contact with the site owner
 * - `personalize` — adjust personalization (may require consent upgrade)
 * - `language` — change locale / language
 * - `voice` — open the voice input affordance
 */
export type SuggestionActionIntent =
  | 'explore'
  | 'learn'
  | 'compare'
  | 'contact'
  | 'personalize'
  | 'language'
  | 'voice';

/** All valid {@link SuggestionActionIntent} values, in declaration order. */
export const SUGGESTION_ACTION_INTENTS: readonly SuggestionActionIntent[] = [
  'explore',
  'learn',
  'compare',
  'contact',
  'personalize',
  'language',
  'voice',
] as const;
