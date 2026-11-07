import { commonStrings } from '@/constants/strings/common';
import { resultsStrings } from '@/constants/strings/results';
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
  duplicateAdmissions: resultsStrings.duplicateAdmissions,
  validAdmissions: resultsStrings.validAdmissionsByDeadline,
  p95LatencyMs: resultsStrings.p95LatencyMs,
  queuePeak: resultsStrings.peakQueueBacklog,
  appUtilizationPeak: resultsStrings.peakAppUtilization,
  dbUtilizationPeak: resultsStrings.peakDbUtilization,
  totalCost: resultsStrings.costCredits,
  correctnessPassed: resultsStrings.noDuplicates,
  throughputPassed: resultsStrings.admissionTarget,
  budgetMet: resultsStrings.withinBudget,
};
const configLabels: Record<keyof ConfigurationValues, string> = {
  appCapacity: commonStrings.appCapacity,
  dbCapacity: commonStrings.databaseCapacity,
  atomicCheckin: commonStrings.atomicCheckIn,
  retryPolicy: commonStrings.retryPolicy,
  cache: resultsStrings.cache,
};
const configValues: Record<string, string> = {
  LOW: resultsStrings.low,
  MEDIUM: resultsStrings.medium,
  HIGH: resultsStrings.high,
  NO_RETRY: resultsStrings.noRetry,
  RETRY_SAME_KEY: resultsStrings.retryWithTheSameKey,
  RETRY_NEW_IDENTITY: resultsStrings.retryWithANewIdentity,
  OFF: resultsStrings.off,
  ON_READS_ONLY: resultsStrings.readOnlyCache,
};
const formatConfiguration = (value: ConfigurationValues[keyof ConfigurationValues]) =>
  typeof value === 'boolean'
    ? value
      ? resultsStrings.on
      : resultsStrings.off
    : (configValues[value] ?? value);
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
              <CardTitle>{resultsStrings.sameIncidentADifferentDesign}</CardTitle>
              <Badge variant={comparison.status === 'PASSED' ? 'secondary' : 'destructive'}>
                {comparison.status}
              </Badge>
            </div>
            <p className={styles.description}>{resultsStrings.run2Run3IdenticalTraffic}</p>
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
                    <TableHead>{resultsStrings.metric}</TableHead>
                    <TableHead>{resultsStrings.run2Preset}</TableHead>
                    <TableHead>{resultsStrings.run3Repair}</TableHead>
                    <TableHead>{resultsStrings.change}</TableHead>
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
              <section
                className={styles.configDiff}
                aria-label={resultsStrings.configurationChanges}
              >
                <h3>{resultsStrings.whatYouChanged}</h3>
                <p className={styles.description}>
                  {resultsStrings.presetConfigurationComparedWithTheRepair}
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
                ) && (
                  <p className={styles.empty}>{resultsStrings.noConfigurationSettingsChanged}</p>
                )}
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
                <CardTitle>
                  {resultsStrings.run}
                  {runNumber}
                </CardTitle>
                <Badge variant={result.overallGatePassed ? 'secondary' : 'destructive'}>
                  {result.overallGatePassed ? 'PASSED' : 'FAILED'}
                </Badge>
              </div>
              <p className={layoutClassName('muted text-sm')}>
                {runNumber === 1
                  ? resultsStrings.diagnosticBaselineNormalTraffic
                  : runNumber === 2
                    ? resultsStrings.originalPresetIncident
                    : resultsStrings.yourRepairedDesignSameIncident}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={layoutClassName('metrics')}>
                <div>
                  <strong>{result.validAdmissions.toLocaleString()}</strong>
                  <span>{resultsStrings.validAdmissions}</span>
                </div>
                <div>
                  <strong>{result.duplicateAdmissions}</strong>
                  <span>{resultsStrings.duplicates}</span>
                </div>
                <div>
                  <strong>
                    {result.p95LatencyMs.toFixed(0)}
                    {resultsStrings.ms}
                  </strong>
                  <span>{resultsStrings.p95Latency}</span>
                </div>
                <div>
                  <strong>{result.totalCost}</strong>
                  <span>{resultsStrings.credits}</span>
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
                        {resultsStrings.rule}
                        {f.rule}
                        {resultsStrings.controls}
                        {f.causedBy.join(', ') || resultsStrings.gateConnectivity}
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
