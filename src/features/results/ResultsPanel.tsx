import { layoutClassName } from '@/styles/layout';
import type {
  Comparison,
  ConfigurationValues,
  RunView,
  SimulationResult,
} from '@scalesquad/shared';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatMetric, metricDirection } from '@/utils/formatMetric';
import styles from './results.module.css';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
const labels: Record<string, string> = {
  duplicateAdmissions: 'Duplicate admissions',
  validAdmissions: 'Valid admissions by deadline',
  p95LatencyMs: 'P95 latency (ms)',
  queuePeak: 'Peak queue backlog',
  appUtilizationPeak: 'Peak app utilization',
  dbUtilizationPeak: 'Peak DB utilization',
  totalCost: 'Cost (credits)',
  correctnessPassed: 'No duplicates',
  throughputPassed: 'Admission target',
  budgetMet: 'Within budget',
};
const configLabels: Record<keyof ConfigurationValues, string> = {
  appCapacity: 'App capacity',
  dbCapacity: 'Database capacity',
  atomicCheckin: 'Atomic check-in',
  retryPolicy: 'Retry policy',
  cache: 'Cache',
};
const configValues: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  NO_RETRY: 'No retry',
  RETRY_SAME_KEY: 'Retry with the same key',
  RETRY_NEW_IDENTITY: 'Retry with a new identity',
  OFF: 'Off',
  ON_READS_ONLY: 'Read-only cache',
};
const formatConfiguration = (value: ConfigurationValues[keyof ConfigurationValues]) =>
  typeof value === 'boolean' ? (value ? 'On' : 'Off') : (configValues[value] ?? value);
function Direction({ metric, before, after }: { metric: string; before: number; after: number }) {
  const direction = metricDirection(metric, before, after);
  const Icon =
    direction.movement === 'up'
      ? ArrowUpRight
      : direction.movement === 'down'
        ? ArrowDownRight
        : Minus;
  return (
    <span className={styles.direction} data-tone={direction.tone}>
      <Icon aria-hidden="true" />
      {direction.label}
    </span>
  );
}
export function Gates({ result }: { result: SimulationResult }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['correctnessPassed', 'throughputPassed', 'budgetMet'] as const).map((g) => (
        <Badge key={g} variant={result[g] ? 'secondary' : 'destructive'}>
          {result[g] ? '✓' : '×'} {labels[g]}
        </Badge>
      ))}
    </div>
  );
}
export function ResultsPanel({
  runs,
  comparison,
  presetConfiguration,
  repairedConfiguration,
}: {
  runs: RunView[];
  comparison: Comparison | null;
  presetConfiguration: ConfigurationValues;
  repairedConfiguration: ConfigurationValues;
}) {
  return (
    <section className={styles.panel}>
      {comparison && (
        <Card>
          <CardHeader>
            <div className={styles.heading}>
              <CardTitle>Same incident. A different design.</CardTitle>
              <Badge variant={comparison.status === 'PASSED' ? 'secondary' : 'destructive'}>
                {comparison.status}
              </Badge>
            </div>
            <p className={styles.description}>
              Run 2 → Run 3 · Identical traffic, outage and engine. Only your configuration changed.
            </p>
          </CardHeader>
          <CardContent className={styles.comparison}>
            <div className={layoutClassName('mobile-metrics')}>
              {comparison.metrics.map((m) => (
                <article className={styles.mobileMetric} key={m.metric}>
                  <h3>{labels[m.metric] ?? m.metric}</h3>
                  <p>
                    {formatMetric(m.metric, m.before)} →{' '}
                    <strong>{formatMetric(m.metric, m.after)}</strong>
                  </p>
                  <Direction metric={m.metric} before={m.before} after={m.after} />
                </article>
              ))}
            </div>
            <div className={layoutClassName('desktop-metrics')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Run 2 · Preset</TableHead>
                    <TableHead>Run 3 · Repair</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.metrics.map((m) => (
                    <TableRow key={m.metric}>
                      <TableCell>{labels[m.metric] ?? m.metric}</TableCell>
                      <TableCell>{formatMetric(m.metric, m.before)}</TableCell>
                      <TableCell>{formatMetric(m.metric, m.after)}</TableCell>
                      <TableCell>
                        <Direction metric={m.metric} before={m.before} after={m.after} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {presetConfiguration && repairedConfiguration && (
              <section className={styles.configDiff} aria-label="Configuration changes">
                <h3>What you changed</h3>
                <p className={styles.description}>
                  Preset configuration compared with the repair used in Run 3.
                </p>
                <ul className={styles.changes}>
                  {(Object.keys(configLabels) as (keyof ConfigurationValues)[])
                    .filter((key) => presetConfiguration[key] !== repairedConfiguration[key])
                    .map((key) => (
                      <li key={key}>
                        <strong>{configLabels[key]}</strong>
                        <span>
                          {formatConfiguration(presetConfiguration[key])} →{' '}
                          {formatConfiguration(repairedConfiguration[key])}
                        </span>
                      </li>
                    ))}
                </ul>
                {(Object.keys(configLabels) as (keyof ConfigurationValues)[]).every(
                  (key) => presetConfiguration[key] === repairedConfiguration[key],
                ) && <p className={styles.empty}>No configuration settings changed.</p>}
              </section>
            )}
            <ul className="fact-list">
              {comparison.gatesChanged.map((g) => (
                <li key={g.gate}>
                  {labels[g.gate]}: {g.before ? 'PASSED' : 'FAILED'} →{' '}
                  {g.after ? 'PASSED' : 'FAILED'}
                </li>
              ))}
              {comparison.tradeoffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <div className={layoutClassName('run-grid')}>
        {runs.map(({ runNumber, result }) => (
          <Card key={runNumber}>
            <CardHeader>
              <div className={styles.heading}>
                <CardTitle>Run {runNumber}</CardTitle>
                <Badge variant={result.overallGatePassed ? 'secondary' : 'destructive'}>
                  {result.overallGatePassed ? 'PASSED' : 'FAILED'}
                </Badge>
              </div>
              <p className={layoutClassName('muted text-sm')}>
                {runNumber === 1
                  ? 'Diagnostic baseline · normal traffic'
                  : runNumber === 2
                    ? 'Original preset · incident'
                    : 'Your repaired design · same incident'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={layoutClassName('metrics')}>
                <div>
                  <strong>{result.validAdmissions.toLocaleString()}</strong>
                  <span>valid admissions</span>
                </div>
                <div>
                  <strong>{result.duplicateAdmissions}</strong>
                  <span>duplicates</span>
                </div>
                <div>
                  <strong>{result.p95LatencyMs.toFixed(0)} ms</strong>
                  <span>P95 latency</span>
                </div>
                <div>
                  <strong>{result.totalCost}</strong>
                  <span>credits</span>
                </div>
              </div>
              <Gates result={result} />
              <ul className={layoutClassName('reason-list')}>
                {result.failureReasons.map((f) => (
                  <li key={f.code}>
                    <details>
                      <summary>
                        <strong>{f.code.replaceAll('_', ' ')}</strong>
                      </summary>
                      <p>{f.message}</p>
                      <small>
                        Rule: {f.rule} · Controls: {f.causedBy.join(', ') || 'gate connectivity'}
                      </small>
                    </details>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
