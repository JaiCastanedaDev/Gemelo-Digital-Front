import { buildSensorStatusMap, formatDateTime, formatNumber, formatRelative, type RangeKey } from '@gd/domain';
import { useAlerts, useSensors } from '@gd/query';
import { X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '../../ui/StatusBadge';
import { STATUS_META } from '../../ui/statusMeta';
import { useNow } from '../../ui/useNow';
import { categoryLabel } from '../alerts/alertCopy';
import { SensorSeriesPanel } from '../series/SensorSeriesPanel';
import { seriesLabel } from '../series/seriesCopy';
import styles from './Sensors.module.css';

interface SensorDetailPanelProps {
  sensorId: string;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  onClose: () => void;
}

export function SensorDetailPanel({ sensorId, range, onRangeChange, onClose }: SensorDetailPanelProps) {
  const sensors = useSensors();
  const alerts = useAlerts('ADMIN', {});
  const now = useNow();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sensor = sensors.data?.data.find((s) => s.sensor_id === sensorId);
  const sensorAlerts = useMemo(
    () => (alerts.data?.data ?? []).filter((a) => a.sensor_id === sensorId),
    [alerts.data, sensorId],
  );
  const markers = useMemo(
    () =>
      sensorAlerts
        .filter((a) => a.level === 'CRITICAL' || a.level === 'WARNING')
        .map((a) => ({ t: Date.parse(a.timestamp), label: STATUS_META[a.level].label })),
    [sensorAlerts],
  );
  const status = sensor ? buildSensorStatusMap([sensor], sensorAlerts, now).get(sensorId) : undefined;

  useEffect(() => {
    headingRef.current?.focus();
  }, [sensorId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside className={styles.detail} aria-labelledby="sensor-detail-title">
      <div className={styles.detailHeader}>
        <h2 id="sensor-detail-title" ref={headingRef} tabIndex={-1}>
          Detalle del sensor
        </h2>
        <button type="button" className={styles.close} aria-label="Cerrar detalle del sensor" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      {sensors.isPending ? (
        <p role="status">Cargando sensor…</p>
      ) : !sensor ? (
        <p>No encontramos este sensor.</p>
      ) : (
        <>
          <h3 className={styles.name}>{sensor.name}</h3>
          {status && <StatusBadge level={status.level} lastSeenAt={sensor.last_seen_at} now={now} />}
          <dl className={styles.facts}>
            <dt>Zona</dt>
            <dd>{sensor.zone}</dd>
            <dt>Categoría</dt>
            <dd>{categoryLabel(sensor.category)}</dd>
            <dt>Batería</dt>
            <dd>{sensor.last_battery_pct === null ? '—' : `${formatNumber(sensor.last_battery_pct, 0)} %`}</dd>
            <dt>Firmware</dt>
            <dd>{sensor.firmware_version ?? '—'}</dd>
            <dt>Última lectura</dt>
            <dd>{formatDateTime(sensor.last_seen_at)}</dd>
            {Object.entries(sensor.last_values ?? {}).map(([key, value]) => (
              <Fragment key={key}>
                <dt>{seriesLabel(key)}</dt>
                <dd>
                  {formatNumber(value, 3)} {sensor.unit ?? ''}
                </dd>
              </Fragment>
            ))}
          </dl>

          <SensorSeriesPanel sensor={sensor} range={range} onRangeChange={onRangeChange} markers={markers} />

          <section aria-labelledby="sensor-alerts-title">
            <h3 id="sensor-alerts-title">Alertas de este sensor</h3>
            {sensorAlerts.length === 0 ? (
              <p>Sin alertas registradas para este sensor.</p>
            ) : (
              <ul className={styles.alerts}>
                {sensorAlerts.map((alert) => (
                  <li key={alert.alert_id}>
                    <Link to={`/alertas?alerta=${encodeURIComponent(alert.alert_id)}`}>
                      <StatusBadge level={alert.level} />
                      {alert.message} · {formatRelative(alert.timestamp, now)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className={styles.actions}>
            <Link to={`/gemelo?sensor=${encodeURIComponent(sensor.sensor_id)}`}>Ver en 3D</Link>
          </div>
        </>
      )}
    </aside>
  );
}
