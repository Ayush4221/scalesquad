import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ResultsPanel } from '../../src/features/results/ResultsPanel';
import { loadScenario } from '../../src/scenario';
import { formatPercent, metricDirection } from '../../src/utils/formatMetric';
import { makeBundle, runSimulation } from '../../src/sim';
afterEach(cleanup);

it('formats ratios as percentages and explains overload in simulation failures', () => {
  expect(formatPercent(0.85)).toBe('85%');
  expect(formatPercent(2.4)).toBe('240%');
  const s = loadScenario();
  const result = runSimulation(makeBundle(s, s.presetConfiguration, 'incident'));
  expect(result.failureReasons.find((r) => r.code === 'APP_SATURATED')?.message).toMatch(
    /utilization: [\d.]+%\./,
  );
});
it('shows repaired configuration changes and accessible metric direction', () => {
  const s = loadScenario();
  render(
    <ResultsPanel
      runs={[]}
      comparison={{
        status: 'PASSED',
        metrics: [
          { metric: 'appUtilizationPeak', before: 1.2, after: 0.85 },
          { metric: 'validAdmissions', before: 2000, after: 2600 },
          { metric: 'totalCost', before: 35, after: 75 },
        ],
        gatesChanged: [],
        tradeoffs: [],
      }}
      presetConfiguration={s.presetConfiguration}
      repairedConfiguration={s.referenceRepair}
    />,
  );
  expect(screen.getAllByText('85%').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Improved').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Higher cost').length).toBeGreaterThan(0);
  const changes = screen.getByRole('region', { name: 'Configuration changes' });
  expect(within(changes).getByText('Atomic check-in')).toBeVisible();
  expect(within(changes).getByText('Off → On')).toBeVisible();
  expect(
    within(changes).getByText('Retry with a new identity → Retry with the same key'),
  ).toBeVisible();
  expect(within(changes).queryByText('Cache')).not.toBeInTheDocument();
  expect(metricDirection('validAdmissions', 100, 120).tone).toBe('positive');
  expect(metricDirection('duplicateAdmissions', 0, 2).tone).toBe('negative');
});
