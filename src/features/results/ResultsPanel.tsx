import type { Comparison, RunView, SimulationResult } from '@scalesquad/shared';
import { MetricCard } from '@/components/shared/MatchNavigation';
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
}: {
  runs: RunView[];
  comparison: Comparison | null;
}) {
  return (
    <section className="space-y-6">
      {comparison && (
        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle>Same incident. A different design.</CardTitle>
              <Badge variant={comparison.status === 'PASSED' ? 'secondary' : 'destructive'}>
                {comparison.status}
              </Badge>
            </div>
            <p className="muted">
              Run 2 → Run 3 · Identical traffic, outage and engine. Only your configuration changed.
            </p>
          </CardHeader>
          <CardContent>
            <div className="mobile-metrics">
              {comparison.metrics.map((m) => (
                <MetricCard
                  key={m.metric}
                  label={labels[m.metric] ?? m.metric}
                  before={m.before}
                  after={m.after}
                />
              ))}
            </div>
            <div className="desktop-metrics">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Run 2 · Preset</TableHead>
                    <TableHead>Run 3 · Repair</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.metrics.map((m) => (
                    <TableRow key={m.metric}>
                      <TableCell>{labels[m.metric] ?? m.metric}</TableCell>
                      <TableCell>{Number(m.before.toFixed(2)).toLocaleString()}</TableCell>
                      <TableCell>{Number(m.after.toFixed(2)).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
      <div className="run-grid">
        {runs.map(({ runNumber, result }) => (
          <Card key={runNumber}>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>Run {runNumber}</CardTitle>
                <Badge variant={result.overallGatePassed ? 'secondary' : 'destructive'}>
                  {result.overallGatePassed ? 'PASSED' : 'FAILED'}
                </Badge>
              </div>
              <p className="muted text-sm">
                {runNumber === 1
                  ? 'Diagnostic baseline · normal traffic'
                  : runNumber === 2
                    ? 'Original preset · incident'
                    : 'Your repaired design · same incident'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="metrics">
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
              <ul className="reason-list">
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
