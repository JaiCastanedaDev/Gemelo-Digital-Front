import { describeVariation, formatDate, formatNumber } from '@gd/domain';
import { POLL_INTERVALS_MS, useDashboardConsumption, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataState } from '../../ui/DataState';
import { EChart } from '../../ui/chart/EChart';
import { buildComparisonOption } from '../../ui/chart/barOptions';
import { chartTheme, seriesPalette } from '../../ui/chart/palette';
import styles from '../dashboards/Dashboards.module.css';
import { SensorDetailPanel } from '../sensors/SensorDetailPanel';
import { withSensorView } from '../sensors/sensorView';
import { useSensorSelection } from '../sensors/useSensorSelection';

export function ConsumptionPage() {
  const [params] = useSearchParams();
  const selection = useSensorSelection();
  const consumption = useDashboardConsumption();
  const sensors = useSensors();
  const meters = useMemo(() => (sensors.data?.data ?? []).filter((s) => s.category === 'consumption'), [sensors.data]);
  const options = useMemo(() => {
    const palette = seriesPalette();
    const theme = chartTheme();
    return new Map(
      (consumption.data?.by_unit ?? []).map((item) => [
        item.unit,
        buildComparisonOption({ unit: item.unit, current: item.current_period, previous: item.previous_period, palette, theme }),
      ]),
    );
  }, [consumption.data]);

  return (
    <div className={styles.page}>
      <header>
        <h1>Consumos</h1>
        <p className={styles.intro}>Agua y energía de las zonas comunes: mes en curso frente al mismo tramo del mes anterior.</p>
      </header>
      <div className={styles.layout} data-detail={selection.view.sensorId ? 'open' : undefined}>
        <div className={styles.column}>
          <DataState
            label="consumos"
            query={consumption}
            staleAfterMs={POLL_INTERVALS_MS.dashboardConsumption * 2}
            isEmpty={(data) => data.by_unit.length === 0}
            emptyMessage="Aún no hay consumos registrados este mes."
          >
            {(data) => (
              <>
                <p className={styles.intro}>
                  Periodo: del {formatDate(data.period.from)} al {formatDate(data.period.to)}
                </p>
                <div className={styles.grid}>
                  {data.by_unit.map((item) => {
                    const variation = describeVariation(item.variation_pct);
                    const option = options.get(item.unit);
                    return (
                      <section key={item.unit} className={styles.card} aria-label={`Consumo en ${item.unit}`}>
                        <h2>{item.unit}</h2>
                        <dl className={styles.figures}>
                          <dt>Mes en curso</dt>
                          <dd>
                            {formatNumber(item.current_period)} {item.unit}
                          </dd>
                          <dt>Mismo tramo del mes anterior</dt>
                          <dd>{item.previous_period === null ? 'Sin datos' : `${formatNumber(item.previous_period)} ${item.unit}`}</dd>
                        </dl>
                        <p className={styles.variation} data-direction={variation.direction ?? undefined}>
                          {variation.text}
                        </p>
                        {option && (
                          <EChart
                            option={option}
                            label={`Comparación del consumo en ${item.unit}: mes en curso frente al mes anterior`}
                            height={200}
                          />
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </DataState>

          <section className={styles.card} aria-labelledby="meters-title">
            <h2 id="meters-title">Medidores</h2>
            <ul className={styles.list}>
              {meters.map((sensor) => (
                <li key={sensor.sensor_id}>
                  <Link to={`?${withSensorView(params, { sensorId: sensor.sensor_id }).toString()}`}>
                    {sensor.name} · {sensor.zone}
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
