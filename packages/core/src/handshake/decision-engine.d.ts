/**
 * @module handshake/decision-engine
 * @description
 * HandshakeDecisionEngine — فاز تصمیم‌گیری handshake.
 * Determines the final UI configuration (locale, direction, theme, layer,
 * hero copy, and consent requirement) from enriched visitor context.
 */
import type { EnrichedContext } from '../types/visitor.js';
import type { HandshakeDecision } from '../types/api.js';
/**
 * موتور تصمیم‌گیری Context Handshake — فاز decide.
 * Decision engine for the Context Handshake — the decide phase.
 *
 * Receives an EnrichedContext and returns a HandshakeDecision with:
 * - selectedLayer: CapabilityLayer
 * - uiConfig: UIConfig (locale, direction, theme, heroCopy, consentRequired)
 *
 * @example
 * const engine = new HandshakeDecisionEngine();
 * const decision = engine.decide(enriched);
 * console.log(decision.uiConfig.locale);     // "fa-IR"
 * console.log(decision.uiConfig.direction);  // "rtl"
 * console.log(decision.selectedLayer);       // "CSS_3D"
 */
export declare class HandshakeDecisionEngine {
    /**
     * اجرای تصمیم‌گیری بر اساس زمینه غنی‌شده.
     * Executes decision logic based on enriched visitor context.
     *
     * @param enriched - EnrichedContext از EnrichmentPipeline.enrich()
     * @returns HandshakeDecision
     *
     * @example
     * const decision = engine.decide(enriched);
     * const { selectedLayer, uiConfig } = decision;
     */
    decide(enriched: EnrichedContext): HandshakeDecision;
    private resolveLanguage;
    private resolveLocale;
    private resolveDirection;
    private requiresConsent;
    private resolveHeroCopy;
    private buildCSSVariables;
}
//# sourceMappingURL=decision-engine.d.ts.map