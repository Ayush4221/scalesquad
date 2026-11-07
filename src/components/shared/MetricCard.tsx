import { layoutClassName } from '@/styles/layout';
export function MetricCard({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  return (
    <article className={layoutClassName('metric-card')}>
      <h3>{label}</h3>
      <p>
        {Number(before.toFixed(2)).toLocaleString()} →{' '}
        <strong>{Number(after.toFixed(2)).toLocaleString()}</strong>
      </p>
      <small>Change: {Number((after - before).toFixed(2)).toLocaleString()}</small>
    </article>
  );
}
