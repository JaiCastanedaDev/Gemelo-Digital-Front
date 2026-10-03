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
  // Indexado por posición de la serie: dos series con el mismo nombre no se mezclan.
  const byTime = new Map<number, Map<number, number>>();
  series.forEach((s, index) => {
    for (const [t, v] of s.points) {
      const row = byTime.get(t) ?? new Map<number, number>();
      row.set(index, v);
      byTime.set(t, row);
    }
  });
  const times = [...byTime.keys()].sort((a, b) => b - a);
  const shown = times.slice(0, maxRows);
  const suffix = unit ? ` (${unit})` : '';
  return (
    <div className={styles.tableWrap} role="region" tabIndex={0} aria-label={`${caption} (desplazable)`}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha y hora</th>
            {series.map((s, index) => (
              <th key={index} scope="col">
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
              {series.map((_, index) => (
                <td key={index}>{formatNumber(byTime.get(t)?.get(index), 3)}</td>
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
