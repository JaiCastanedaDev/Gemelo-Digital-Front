import { clampScore, healthBand } from '@gd/domain';
import { POLL_INTERVALS_MS, useDashboardStructural } from '@gd/query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataState } from '../../ui/DataState';
import { StatusBadge } from '../../ui/StatusBadge';
import { STATUS_META } from '../../ui/statusMeta';
import styles from '../dashboards/Dashboards.module.css';
import { BAND_LABEL, BAND_TONE } from '../home/healthCopy';
import { SensorDetailPanel } from '../sensors/SensorDetailPanel';
import { AlertsNotice, SensorStatusBadge } from '../sensors/StatusParts';
import { withSensorView } from '../sensors/sensorView';
import { useSensorSelection } from '../sensors/useSensorSelection';
import { useSensorStatuses } from '../sensors/useSensorStatuses';

export function StructuralPage() {
  const [params] = useSearchParams();
  const selection = useSensorSelection();
  const structural = useDashboardStructural();
  const { sensors, alertsState, statuses, now, retryAlerts } = useSensorStatuses();
  const structuralSensors = useMemo(
    () => (sensors.data?.data ?? []).filter((s) => s.category === 'structural'),
    [sensors.data],
  );
  const nameOf = (id: string) => structuralSensors.find((s) => s.sensor_id === id)?.name ?? id;
  const detailHref = (id: string) => `?${withSensorView(params, { sensorId: id }).toString()}`;

  return (
    <div className={styles.page}>
      <header>
        <h1>Estructural</h1>
        <p className={styles.intro}>Vibraciones, inclinación y fisuras medidas en las zonas comunes.</p>
      </header>
      <div className={styles.layout} data-detail={selection.view.sensorId ? 'open' : undefined}>
        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="structural-health-title">
            <h2 id="structural-health-title">Salud estructural</h2>
            <DataState label="salud estructural" query={structural} staleAfterMs={POLL_INTERVALS_MS.dashboardStructural * 2}>
              {(data) => {
                const score = clampScore(data.structural_score);
                const band = healthBand(score);
                const tone = BAND_TONE[band];
                const { Icon } = STATUS_META[tone];
                return (
                  <>
                    <p className={styles.score}>
                      <span>{score}</span>
                      <span className={styles.scoreMax}>/100</span>
                    </p>
                    <span className={styles.band} data-tone={tone}>
                      <Icon aria-hidden="true" size={18} />
                      {BAND_LABEL[band]}
                    </span>
                  </>
                );
              }}
            </DataState>
          </section>

          <section className={styles.card} aria-labelledby="structural-alert-title">
            <h2 id="structural-alert-title">Sensores en alerta</h2>
            {structural.data &&
              (structural.data.sensors_in_alert.length === 0 ? (
                <p className={styles.empty}>No hay sensores estructurales en alerta.</p>
              ) : (
                <ul className={styles.list}>
                  {structural.data.sensors_in_alert.map((item) => (
                    <li key={item.sensor_id}>
                      <Link to={detailHref(item.sensor_id)}>
                        <StatusBadge level={item.level} />
                        {nameOf(item.sensor_id)} · {item.alerts === 1 ? '1 alerta' : `${item.alerts} alertas`}
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}
          </section>

          <section className={styles.card} aria-labelledby="structural-sensors-title">
            <h2 id="structural-sensors-title">Sensores estructurales</h2>
            <AlertsNotice state={alertsState} onRetry={retryAlerts} />
            <ul className={styles.list}>
              {structuralSensors.map((sensor) => (
                <li key={sensor.sensor_id}>
                  <Link to={detailHref(sensor.sensor_id)}>
                    <SensorStatusBadge status={statuses.get(sensor.sensor_id)} lastSeenAt={sensor.last_seen_at} now={now} />
                    {sensor.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
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
