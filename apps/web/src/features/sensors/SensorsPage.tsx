import type { Sensor } from '@gd/api';
import { STATUS_ORDER, formatNumber, formatRelative, type SensorStatus } from '@gd/domain';
import { POLL_INTERVALS_MS } from '@gd/query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataState } from '../../ui/DataState';
import { STATUS_META } from '../../ui/statusMeta';
import { CATEGORY_OPTIONS, categoryLabel } from '../alerts/alertCopy';
import { SensorDetailPanel } from './SensorDetailPanel';
import { readSensorFilters, writeSensorFilters, type SensorFilters } from './sensorFilters';
import { withSensorView } from './sensorView';
import styles from './Sensors.module.css';
import { useSensorSelection } from './useSensorSelection';
import { SensorStatusBadge } from './StatusParts';
import { useSensorStatuses } from './useSensorStatuses';
import { ZoneDensityCard } from './ZoneDensityCard';

interface Row {
  sensor: Sensor;
  status: SensorStatus | undefined;
}

function severityRank(status: SensorStatus | undefined): number {
  if (!status) return -1; // desconocido: arriba, nunca como normal
  return STATUS_ORDER.indexOf(status.level);
}

export function SensorsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readSensorFilters(params);
  const selection = useSensorSelection();
  const { sensors, alertsState, statuses, now, retryAlerts } = useSensorStatuses();

  const rows = useMemo<Row[]>(
    () =>
      [...(sensors.data?.data ?? [])]
        .map((sensor) => ({ sensor, status: statuses.get(sensor.sensor_id) }))
        .sort((a, b) => severityRank(a.status) - severityRank(b.status) || a.sensor.name.localeCompare(b.sensor.name, 'es')),
    [sensors.data, statuses],
  );

  const zones = useMemo(() => [...new Set(rows.map((r) => r.sensor.zone))].sort((a, b) => a.localeCompare(b, 'es')), [rows]);
  const visible = rows.filter(
    (r) =>
      (!filters.status || r.status?.level === filters.status) &&
      (!filters.category || r.sensor.category === filters.category) &&
      (!filters.zone || r.sensor.zone === filters.zone),
  );
  const allStatuses = useMemo(() => rows.flatMap((r) => (r.status ? [r.status] : [])), [rows]);

  const update = (patch: SensorFilters) => setParams(writeSensorFilters(params, { ...filters, ...patch }), { replace: true });

  return (
    <div className={styles.page}>
      <header>
        <h1>Sensores</h1>
        <p className={styles.intro}>Estado, batería y lecturas de los sensores de las zonas comunes.</p>
      </header>

      <form className={styles.filters} aria-label="Filtros de sensores" onSubmit={(e) => e.preventDefault()}>
        <label>
          Estado
          <select
            value={filters.status ?? ''}
            onChange={(e) => update({ status: STATUS_ORDER.find((l) => l === e.target.value) })}
          >
            <option value="">Todos</option>
            {STATUS_ORDER.map((level) => (
              <option key={level} value={level}>
                {STATUS_META[level].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select
            value={filters.category ?? ''}
            onChange={(e) =>
              update({ category: CATEGORY_OPTIONS.find((o) => o.value !== '' && o.value === e.target.value)?.value || undefined })
            }
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zona
          <select value={filters.zone ?? ''} onChange={(e) => update({ zone: e.target.value || undefined })}>
            <option value="">Todas las zonas</option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className={styles.layout} data-detail={selection.view.sensorId ? 'open' : undefined}>
        <div className={styles.stack}>
          <DataState label="sensores" query={sensors} staleAfterMs={POLL_INTERVALS_MS.sensors * 2}>
            {() => (
              <div className={styles.tableWrap} role="region" tabIndex={0} aria-label="Tabla de sensores (desplazable)">
                <table className={styles.table}>
                  <caption>Sensores ({visible.length})</caption>
                  <thead>
                    <tr>
                      <th scope="col">Sensor</th>
                      <th scope="col">Zona</th>
                      <th scope="col">Categoría</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Batería</th>
                      <th scope="col">Firmware</th>
                      <th scope="col">Último reporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ sensor, status }) => (
                      <tr key={sensor.sensor_id}>
                        <td>
                          <Link
                            to={`?${withSensorView(params, { sensorId: sensor.sensor_id }).toString()}`}
                            aria-current={selection.view.sensorId === sensor.sensor_id ? 'true' : undefined}
                          >
                            {sensor.name}
                          </Link>
                        </td>
                        <td>{sensor.zone}</td>
                        <td>{categoryLabel(sensor.category)}</td>
                        <td>
                          <SensorStatusBadge status={status} lastSeenAt={sensor.last_seen_at} now={now} />
                        </td>
                        <td>{sensor.last_battery_pct === null ? '—' : `${formatNumber(sensor.last_battery_pct, 0)} %`}</td>
                        <td>{sensor.firmware_version ?? '—'}</td>
                        <td>{formatRelative(sensor.last_seen_at, now)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataState>
          {sensors.data && <ZoneDensityCard statuses={allStatuses} alertsState={alertsState} onRetry={retryAlerts} />}
        </div>
        {selection.view.sensorId && (
          <SensorDetailPanel
            key={selection.view.sensorId}
            sensorId={selection.view.sensorId}
            range={selection.view.range}
            onRangeChange={selection.setRange}
            onClose={selection.close}
          />
        )}
      </div>
    </div>
  );
}
