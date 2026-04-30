import type { OrchestratorTelemetryEvent } from '@alphabet/core/orchestrator';

const MAX_EVENTS = 500;
const events: OrchestratorTelemetryEvent[] = [];

export function pushTelemetry(event: OrchestratorTelemetryEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function readTelemetry(): ReadonlyArray<OrchestratorTelemetryEvent> {
  return events;
}
