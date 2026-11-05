import type { EvidenceCard, EvidencePhase, Role } from '@scalesquad/shared';
import type { ScenarioConfig } from './schema';

export const evidenceFacts = {
  TRAFFIC: {
    BRIEFING: ['peak_rps', 'spike_duration', 'retry_pct'],
    INCIDENT_EVIDENCE: ['incident_retry_pct'],
  },
  DATA: {
    BRIEFING: ['db_write_cap', 'atomic_status', 'race_test'],
    INCIDENT_EVIDENCE: ['committed_timeout', 'stale_replica'],
  },
  OPS: {
    BRIEFING: ['budget_total', 'component_prices'],
    INCIDENT_EVIDENCE: ['outage_window', 'recovery_policy'],
  },
} as const;
export function buildEvidenceCard(
  role: Role,
  phase: EvidencePhase,
  s: ScenarioConfig,
): EvidenceCard {
  const p = s.profiles.incident;
  const peak = Math.max(...s.trafficSeries.incident);
  const texts = {
    peak_rps: `Incident peak: ${peak} scan attempts/s. Normal peak: ${Math.max(...s.trafficSeries.normal)}.`,
    spike_duration: `The peak lasts ${s.trafficSeries.incident.filter((n) => n === peak).length} seconds. First peak at second ${s.trafficSeries.incident.indexOf(peak)}.`,
    retry_pct: `${s.profiles.normal.retryAfterTimeoutRate * 100}% of timed-out users retry during normal traffic.`,
    incident_retry_pct: `During the incident ${p.retryAfterTimeoutRate * 100}% of timed-out users retry. Retries add load.`,
    db_write_cap: `DB LOW/MEDIUM/HIGH: ${Object.values(s.tiers.db)
      .map((t) => t.capacityRps)
      .join('/')} writes/s. App LOW/MEDIUM/HIGH: ${Object.values(s.tiers.app)
      .map((t) => t.capacityRps)
      .join('/')} requests/s.`,
    atomic_status: `Preset atomic check-in: ${s.presetConfiguration.atomicCheckin ? 'ON' : 'OFF'}. Atomic compare-and-set prevents repeated admission. Capacity does not make a write atomic.`,
    race_test: `At second ${s.simultaneousScan.second}, gates ${s.simultaneousScan.gateIds.join(', ')} scan ${s.simultaneousScan.passIds.join(', ')} inside a ${s.raceWindowMs}ms window.`,
    committed_timeout: `Passes ${p.committedTimeoutPassIds.join(', ')} commit before the response times out. Reuse the original idempotency key to recover the result.`,
    stale_replica: `Stale replica during incident: ${p.staleReplica}. Cache may speed up reads but cannot authorize admission.`,
    budget_total: `Hard budget: ${s.budgetLimit} credits.`,
    component_prices: `App LOW/MEDIUM/HIGH: ${Object.values(s.tiers.app)
      .map((t) => t.cost)
      .join('/')}; DB: ${Object.values(s.tiers.db)
      .map((t) => t.cost)
      .join('/')}; cache: ${s.cache.cost}; queue: ${s.queue.enabled ? s.queue.cost : 0} credits.`,
    outage_window: `Gates ${p.offlineGateIds.join(', ')} offline from second ${p.outage?.from ?? 0} until ${p.outage?.to ?? 0}.`,
    recovery_policy: `Offline scans stay pending; replay original keys when connected. Confirmations after ${s.deadlineSeconds}s do not meet the target.`,
  };
  return {
    id: `${role}_${phase}`,
    role,
    phase,
    private: true,
    facts: evidenceFacts[role][phase].map((id) => ({ id, text: texts[id] })),
  };
}
