import { formatDateTime, formatNumber } from '@gd/domain';
import styles from './Chart.module.css';
import type { ChartSeries } from './timeSeriesOption';

interface SeriesTableProps {
  caption: string;
  series: ChartSeries[];
  unit: string | null;
  maxRows?: number;
}

export function SeriesTable({ caption, series, unit, maxRows = 200 }: SeriesTableProps) {
  const byTime = new Map<number, Map<string, number>>();
  for (const s of series) {
    for (const [t, v] of s.points) {
      const row = byTime.get(t) ?? new Map<string, number>();
      row.set(s.name, v);
      byTime.set(t, row);
    }
  }
  const times = [...byTime.keys()].sort((a, b) => b - a);
  const shown = times.slice(0, maxRows);
  const suffix = unit ? ` (${unit})` : '';
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha y hora</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
                {suffix}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((t) => (
            <tr key={t}>
              <td>{formatDateTime(new Date(t).toISOString())}</td>
              {series.map((s) => (
                <td key={s.name}>{formatNumber(byTime.get(t)?.get(s.name), 3)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {times.length > shown.length && (
        <p className={styles.note}>
          Se muestran las {shown.length} lecturas más recientes de {times.length}.
        </p>
      )}
    </div>
  );
}
