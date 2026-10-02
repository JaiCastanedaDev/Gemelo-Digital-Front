import { CATEGORY_OPTIONS, LEVEL_OPTIONS, STATE_OPTIONS } from './alertCopy';
import { readAlertsView, writeAlertsView, type AlertsView } from './alertFilters';
import styles from './Alerts.module.css';

interface AlertFiltersBarProps {
  view: AlertsView;
  onChange: (next: AlertsView) => void;
}

/** Los cambios se normalizan pasando por la URL para no aceptar valores fuera de la lista. */
function normalize(view: AlertsView): AlertsView {
  return readAlertsView(writeAlertsView(view));
}

export function AlertFiltersBar({ view, onChange }: AlertFiltersBarProps) {
  const set = (key: 'nivel' | 'acusada' | 'categoria', value: string) => {
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
    </form>
  );
}
