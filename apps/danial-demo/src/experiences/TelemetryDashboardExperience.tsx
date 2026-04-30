import { useMemo } from 'react';
import { readTelemetry } from '../telemetry.js';

export function TelemetryDashboardExperience(): JSX.Element {
  const events = readTelemetry();
  const model = useMemo(() => {
    const layers = new Map<string, number>();
    const consent = new Map<string, number>();
    const timings: number[] = [];
    for (const e of events) {
      if (e.event === 'layer_selected') layers.set(e.layer, (layers.get(e.layer) ?? 0) + 1);
      if (e.event === 'consent_transition') consent.set(`${e.fromTier}→${e.toTier}`, (consent.get(`${e.fromTier}→${e.toTier}`) ?? 0) + 1);
      if (e.event === 'handshake_phase_timing') timings.push(e.durationMs);
    }
    const avg = timings.length === 0 ? 0 : timings.reduce((a,b)=>a+b,0)/timings.length;
    return { layers: [...layers.entries()], consent: [...consent.entries()], avg, count: events.length };
  }, [events]);
  return <div className="alphabet-experience alphabet-grid-3">
    <section className="alphabet-card"><h3 className="alphabet-card-heading">Layer distribution</h3><ul>{model.layers.map(([k,v])=><li key={k}><code>{k}</code>: {v}</li>)}</ul></section>
    <section className="alphabet-card"><h3 className="alphabet-card-heading">Handshake latency</h3><p>Average phase latency: <strong>{model.avg.toFixed(2)} ms</strong></p></section>
    <section className="alphabet-card"><h3 className="alphabet-card-heading">Consent conversion</h3><ul>{model.consent.map(([k,v])=><li key={k}><code>{k}</code>: {v}</li>)}</ul><p className="alphabet-muted-text">Events observed: {model.count}</p></section>
  </div>;
}
