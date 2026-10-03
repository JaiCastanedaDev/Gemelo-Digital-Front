import type { Sensor } from '@gd/api';
import {
  RANGE_MS,
  measuredChange,
  readingsToSeries,
  shorterRange,
  strategyForSensorType,
  type RangeKey,
} from '@gd/domain';
import { useSensorReadings } from '@gd/query';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../app/errorMessage';
import { Button } from '../../ui/Button';
import { EChart } from '../../ui/chart/EChart';
import { RANGE_LABEL, RangeSelector } from '../../ui/chart/RangeSelector';
import { SeriesTable } from '../../ui/chart/SeriesTable';
import { chartTheme, seriesPalette } from '../../ui/chart/palette';
import { buildTimeSeriesOption, type ChartMarker } from '../../ui/chart/timeSeriesOption';
import { formatChange, seriesLabel } from './seriesCopy';
import styles from './Series.module.css';
import { useDownsampledSeries } from './useDownsampledSeries';

const NO_MARKERS: ChartMarker[] = [];

interface SensorSeriesPanelProps {
  sensor: Sensor;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  markers?: ChartMarker[];
}

export function SensorSeriesPanel({ sensor, range, onRangeChange, markers = NO_MARKERS }: SensorSeriesPanelProps) {
  const data = useSensorReadings(sensor.sensor_id, range);
  const raw = useMemo(() => readingsToSeries(data.readings, data.window), [data.readings, data.window]);
  const downsampled = useDownsampledSeries(raw, strategyForSensorType(sensor.sensor_type));
  const [showTable, setShowTable] = useState(false);

  const chartSeries = useMemo(
    () =>
      Object.entries(downsampled.series)
        .filter(([, points]) => points.length > 0)
        .map(([key, points]) => ({ name: seriesLabel(key), points })),
    [downsampled.series],
  );
  const option = useMemo(
    () =>
      buildTimeSeriesOption({
        series: chartSeries,
        unit: sensor.unit,
        palette: seriesPalette(),
        theme: chartTheme(),
        spanMs: RANGE_MS[range],
        markers,
      }),
    [chartSeries, sensor.unit, range, markers],
  );
  const change = sensor.sensor_type === 'crack_meter' ? measuredChange(raw.width ?? []) : null;
  const smaller = shorterRange(range);

  let body;
  if (data.isPending || downsampled.pending) {
    body = <div className={styles.skeleton} role="status" aria-busy="true" aria-label="Cargando lecturas" />;
  } else if (data.isError && !data.partialError) {
    body = (
      <div className={styles.error} role="alert">
        <p>{errorMessage(data.error)}</p>
        <Button variant="secondary" onClick={data.refetch}>
          Reintentar
        </Button>
      </div>
    );
  } else if (data.tooMany) {
    body = (
      <div>
        <p className={styles.message}>El rango tiene demasiadas lecturas para mostrarlas aquí.</p>
        {smaller && (
          <Button variant="secondary" onClick={() => onRangeChange(smaller)}>
            Ver {RANGE_LABEL[smaller]}
          </Button>
        )}
      </div>
    );
  } else if (chartSeries.length === 0) {
    body = <p className={styles.message}>Sin lecturas en este rango.</p>;
  } else {
    body = (
      <>
        {data.partialError && (
          <div className={styles.error} role="alert">
            <p>No se pudieron cargar algunas lecturas; la gráfica puede estar incompleta.</p>
            <Button variant="secondary" onClick={data.refetch}>
              Reintentar
            </Button>
          </div>
        )}
        <EChart option={option} label={`Serie de ${sensor.name}, ${RANGE_LABEL[range]}`} />
        {change !== null && (
          <p className={styles.change}>
            Cambio medido en el periodo: {formatChange(change, sensor.unit)}
          </p>
        )}
        <div>
          <Button variant="secondary" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
          </Button>
        </div>
        {showTable && <SeriesTable caption={`Lecturas de ${sensor.name}`} series={chartSeries} unit={sensor.unit} />}
      </>
    );
  }

  return (
    <section className={styles.panel} aria-label="Lecturas">
      <div className={styles.header}>
        <h3>Lecturas</h3>
        <RangeSelector value={range} onChange={onRangeChange} />
      </div>
      {body}
    </section>
  );
}
