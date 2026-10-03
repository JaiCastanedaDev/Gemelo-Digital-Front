import { COMFORT_TONE, formatNumber } from '@gd/domain';
import { POLL_INTERVALS_MS, useComfort } from '@gd/query';
import { Link, useSearchParams } from 'react-router';
import { useSession } from '../../app/session/SessionProvider';
import { DataState } from '../../ui/DataState';
import { STATUS_META } from '../../ui/statusMeta';
import styles from '../dashboards/Dashboards.module.css';
import { SensorDetailPanel } from '../sensors/SensorDetailPanel';
import { withSensorView } from '../sensors/sensorView';
import { useSensorSelection } from '../sensors/useSensorSelection';
import { COMFORT_LABEL } from './comfortCopy';

function ppmOf(zone: object): number | null {
  const ppm = (zone as { ppm?: unknown }).ppm;
  return typeof ppm === 'number' ? ppm : null;
}

function firstSensorId(sensors: number | string[]): string | null {
  return Array.isArray(sensors) ? (sensors[0] ?? null) : null;
}

export function ComfortPage() {
  const { session } = useSession();
  const role = session?.claims.role ?? 'RESIDENTE';
  const isAdmin = role === 'ADMIN';
  const [params] = useSearchParams();
  const selection = useSensorSelection();
  const comfort = useComfort(role);
  // El residente nunca abre el detalle (ni se monta su panel), aunque la URL traiga ?sensor=.
  const openSensor = isAdmin ? selection.view.sensorId : undefined;

  if (!session) return null;

  return (
    <div className={styles.page}>
      <header>
        <h1>Calidad del aire</h1>
        <p className={styles.intro}>Basado en la concentración de CO₂ medida en cada zona.</p>
      </header>
      <div className={styles.layout} data-detail={openSensor ? 'open' : undefined}>
        <DataState
          label="calidad del aire"
          query={comfort}
          staleAfterMs={POLL_INTERVALS_MS.dashboardComfort * 2}
          isEmpty={(data) => data.zones.length === 0}
          emptyMessage="No hay mediciones de calidad del aire."
        >
          {(data) => (
            <ul className={styles.list} aria-label="Zonas">
              {data.zones.map((zone) => {
                const tone = COMFORT_TONE[zone.index];
                const { Icon } = STATUS_META[tone];
                const ppm = isAdmin ? ppmOf(zone) : null;
                const sensorId = isAdmin ? firstSensorId(zone.sensors) : null;
                return (
                  <li key={zone.zone} className={styles.zone} aria-label={zone.zone}>
                    <strong>{zone.zone}</strong>
                    <span className={styles.band} data-tone={tone}>
                      <Icon aria-hidden="true" size={18} />
                      {COMFORT_LABEL[zone.index]}
                    </span>
                    {ppm !== null && <span>{formatNumber(ppm, 0)} ppm</span>}
                    {sensorId && (
                      <Link
                        className={styles.zoneLink}
                        to={`?${withSensorView(params, { sensorId }).toString()}`}
                        aria-label={`Ver lecturas de ${zone.zone}`}
                      >
                        Ver lecturas
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DataState>
        {openSensor && (
          <SensorDetailPanel
            key={openSensor}
            sensorId={openSensor}
            range={selection.view.range}
            onRangeChange={selection.setRange}
            onClose={selection.close}
          />
        )}
      </div>
    </div>
  );
}
