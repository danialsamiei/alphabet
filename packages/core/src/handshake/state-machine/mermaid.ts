/**
 * @module handshake/state-machine/mermaid
 * @description
 * Mermaid (`stateDiagram-v2`) renderer for the layer-selection transition
 * table. Used by the docs build and the `IMPLEMENTATION_STATUS.md`
 * snapshot — keeps the diagram and the runtime in lock-step (any change
 * to `LAYER_TRANSITIONS` immediately changes the rendered diagram).
 */

import { LAYER_TRANSITIONS, type LayerTransition } from './decision-machine.js';

/**
 * یک Mermaid `stateDiagram-v2` برای مجموعه transitions می‌سازد.
 *
 * خروجی deterministic است (همان ترتیب آرایهٔ ورودی) تا snapshot tests
 * پایدار باشد.
 *
 * @example
 * console.log(toMermaid());
 * // stateDiagram-v2
 * //   [*] --> STATIC_HTML : prefers-reduced-motion
 * //   ...
 */
export function toMermaid(
  transitions: readonly LayerTransition[] = LAYER_TRANSITIONS,
): string {
  const lines: string[] = ['stateDiagram-v2'];
  for (const t of transitions) {
    const fromNode = t.from === 'START' ? '[*]' : t.from;
    // Mermaid: edge label after a colon. Sanitize newlines/colons for safety.
    const label = sanitizeLabel(t.label);
    lines.push(`  ${fromNode} --> ${t.to} : ${label}`);
  }
  return lines.join('\n');
}

/** پاکسازی label برای Mermaid (no `:` inside, no newlines). */
function sanitizeLabel(s: string): string {
  return s.replace(/[:\n]+/g, ' ').trim();
}
