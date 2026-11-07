/** Simulator utilization is a ratio; display it as a percentage, including overload. */
export function formatPercent(ratio: number): string {
  return `${Number((ratio * 100).toFixed(2))}%`;
}
export function formatMetric(metric: string, value: number): string {
  return metric.endsWith('UtilizationPeak')
    ? formatPercent(value)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
export function metricDirection(metric: string, before: number, after: number) {
  if (before === after)
    return { label: 'Unchanged', tone: 'neutral' as const, movement: 'same' as const };
  const increased = after > before;
  const improved = metric === 'validAdmissions' ? increased : !increased;
  return {
    label: improved ? 'Improved' : metric === 'totalCost' ? 'Higher cost' : 'Worsened',
    tone: improved
      ? ('positive' as const)
      : metric === 'totalCost'
        ? ('tradeoff' as const)
        : ('negative' as const),
    movement: increased ? ('up' as const) : ('down' as const),
  };
}
