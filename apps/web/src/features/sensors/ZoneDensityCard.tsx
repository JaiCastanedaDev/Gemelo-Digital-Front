import { STATUS_ORDER, densityByZone, type SensorStatus, type ZoneDensity } from '@gd/domain';
import { useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { EChart } from '../../ui/chart/EChart';
import { buildDensityOption } from '../../ui/chart/barOptions';
import { chartTheme, statusPalette } from '../../ui/chart/palette';
import { STATUS_META } from '../../ui/statusMeta';
import styles from './Sensors.module.css';
import { AlertsNotice } from './StatusParts';
import type { AlertsState } from './useSensorStatuses';

const CAPTION = 'Sensores por zona y estado';

interface ZoneDensityCardProps {
  statuses: SensorStatus[];
  /** Mientras las alertas no estén cargadas no se cuenta nada (desconocido no es normal). */
  alertsState?: AlertsState;
  onRetry?: () => void;
}

export function ZoneDensityCard({ statuses, alertsState = 'ready', onRetry = () => {} }: ZoneDensityCardProps) {
  // Clave estructural: la gráfica solo se reconstruye cuando cambian los conteos.
  const countsKey = JSON.stringify(densityByZone(statuses));
  const zones = useMemo(() => JSON.parse(countsKey) as ZoneDensity[], [countsKey]);
  const option = useMemo(() => buildDensityOption(zones, statusPalette(), chartTheme()), [zones]);
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={styles.card} aria-labelledby="zone-density-title">
      <h2 id="zone-density-title">Sensores por zona</h2>
      {alertsState !== 'ready' ? (
        <AlertsNotice state={alertsState} onRetry={onRetry} />
      ) : zones.length === 0 ? (
        <p>No hay sensores registrados.</p>
      ) : (
        <div className={styles.stack}>
          <EChart option={option} label={CAPTION} height={Math.max(200, zones.length * 36 + 64)} />
          <div>
            <Button variant="secondary" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
            </Button>
          </div>
          {showTable && (
            <div className={styles.tableWrap} role="region" tabIndex={0} aria-label={`${CAPTION} (desplazable)`}>
              <table className={styles.table}>
                <caption>{CAPTION}</caption>
                <thead>
                  <tr>
                    <th scope="col">Zona</th>
                    {STATUS_ORDER.map((level) => (
                      <th key={level} scope="col">
                        {STATUS_META[level].label}
                      </th>
                    ))}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.zone}>
                      <th scope="row">{zone.zone}</th>
                      {STATUS_ORDER.map((level) => (
                        <td key={level}>{zone.counts[level]}</td>
                      ))}
                      <td>{zone.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
