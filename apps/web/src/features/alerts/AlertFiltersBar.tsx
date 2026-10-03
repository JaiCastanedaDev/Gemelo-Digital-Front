import { CATEGORY_OPTIONS, LEVEL_OPTIONS, STATE_OPTIONS } from './alertCopy';
import { datesInverted, readAlertsView, writeAlertsView, type AlertsView } from './alertFilters';
import styles from './Alerts.module.css';

interface AlertFiltersBarProps {
  view: AlertsView;
  onChange: (next: AlertsView) => void;
  sensorOptions: string[];
}

/** Los cambios se normalizan pasando por la URL para no aceptar valores fuera de la lista. */
function normalize(view: AlertsView): AlertsView {
  return readAlertsView(writeAlertsView(view));
}

export function AlertFiltersBar({ view, onChange, sensorOptions }: AlertFiltersBarProps) {
  const set = (key: 'nivel' | 'acusada' | 'categoria' | 'sensor' | 'desde' | 'hasta', value: string) => {
    const params = writeAlertsView(view);
    if (value) params.set(key, value);
    else params.delete(key);
    onChange(normalize(readAlertsView(params)));
  };

  return (
    <form className={styles.filters} aria-label="Filtros de alertas" onSubmit={(e) => e.preventDefault()}>
      <label>
        Nivel
        <select value={view.level ?? ''} onChange={(e) => set('nivel', e.target.value)}>
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estado
        <select
          value={view.acknowledged === undefined ? '' : String(view.acknowledged)}
          onChange={(e) => set('acusada', e.target.value)}
        >
          {STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Categoría
        <select value={view.category ?? ''} onChange={(e) => set('categoria', e.target.value)}>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sensor
        <select value={view.sensorId ?? ''} onChange={(e) => set('sensor', e.target.value)}>
          <option value="">Todos los sensores</option>
          {sensorOptions.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Desde
        <input type="date" value={view.from ?? ''} onChange={(e) => set('desde', e.target.value)} />
      </label>
      <label>
        Hasta
        <input type="date" value={view.to ?? ''} onChange={(e) => set('hasta', e.target.value)} />
      </label>
      {datesInverted(view) && (
        <p className={styles.hint} role="status">
          La fecha inicial es posterior a la final; no se aplica el filtro de fechas.
        </p>
      )}
    </form>
  );
}
