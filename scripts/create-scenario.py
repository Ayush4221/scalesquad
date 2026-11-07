"""Reproduce the initial versioned scenario; runtime reads JSON only."""
import json
from pathlib import Path

preset = dict(appCapacity='LOW', dbCapacity='LOW', atomicCheckin=False,
              retryPolicy='RETRY_NEW_IDENTITY', cache='OFF')
scenario = dict(
    scenarioId='campuspass', scenarioVersion='1', engineCompat=['1.0.0'],
    title='CampusPass festival check-in', deadlineSeconds=60, graceSeconds=10,
    requiredValidAdmissions=2500, totalPasses=10000, timeoutMs=800, raceWindowMs=20,
    trafficSeries={'normal': [60]*60, 'incident': [120]*20+[40]*40},
    tiers={
        'app': dict(LOW=dict(capacityRps=50, baseLatencyMs=30, cost=15),
                    MEDIUM=dict(capacityRps=180, baseLatencyMs=20, cost=35),
                    HIGH=dict(capacityRps=350, baseLatencyMs=10, cost=65)),
        'db': dict(LOW=dict(capacityRps=45, baseLatencyMs=40, cost=20),
                   MEDIUM=dict(capacityRps=160, baseLatencyMs=25, cost=40),
                   HIGH=dict(capacityRps=320, baseLatencyMs=15, cost=65))},
    cache=dict(cost=8, readLatencyMs=5, staleReadProbabilityRule='NON_AUTHORITATIVE_ONLY'),
    queue=dict(enabled=False, maxBacklog=1000, workerRate=150, cost=5),
    latency=dict(overloadStartUtil=.7, steepStartUtil=.9, linearPenaltyMs=50,
                 steepPenaltyMs=600, maxPenaltyMs=2000),
    budgetLimit=100, budgetDisplayRange=[80, 120],
    gates=[{'id': g} for g in ['A', 'B', 'C', 'D']],
    profiles={
        'normal': dict(version='normal-1', retryAfterTimeoutRate=.5,
                       outage=None, offlineGateIds=[], committedTimeoutPassIds=[],
                       staleReplica=False),
        'incident': dict(version='incident-1', retryAfterTimeoutRate=1,
                         outage={'from': 15, 'to': 20}, offlineGateIds=['A', 'B'],
                         committedTimeoutPassIds=['P-5', 'P-10'], staleReplica=True)},
    simultaneousScan=dict(enabled=True, second=0, passIds=['RACE-1'],
                          gateIds=['A', 'B'], profiles=['incident']),
    presetConfiguration=preset,
    referenceRepair={**preset, 'appCapacity': 'MEDIUM', 'dbCapacity': 'MEDIUM',
                     'atomicCheckin': True, 'retryPolicy': 'RETRY_SAME_KEY'},
    match=dict(joinCodeTtlMs=1800000, briefDurationMs=120000, incidentDurationMs=120000,
               compareDurationMs=300000, lockLeaseMs=120000, reclaimAfterMs=15000,
               runTimeoutMs=15000))
Path('src/scenario/data/campuspass.v1.json').write_text(json.dumps(scenario, indent=2)+'\n')

