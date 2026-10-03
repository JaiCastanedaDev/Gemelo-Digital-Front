# Plan 3 — Dashboards y series temporales

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el administrador vea el estado estructural, los consumos, la calidad del aire y cada sensor con series temporales navegables (1 h / 24 h / 7 días / 30 días), y que el residente vea la calidad del aire por zona sin números.

**Architecture:** El dominio (`@gd/domain`) gana rangos de tiempo con tramos diarios alineados a UTC, reducción de series (LTTB y min/max), variación de consumos, densidad por zona y tono del índice de confort. `@gd/query` gana hooks para los dashboards, la lista de sensores y las lecturas por tramos (`useQueries`, tramos cerrados cacheados para siempre). En `apps/web`, ECharts (modular, cargado de forma diferida) dibuja las gráficas; un Web Worker reduce las series largas con *fallback* síncrono; un panel lateral compartido (`SensorDetailPanel`) muestra cada sensor desde Sensores, Estructural, Consumos y Aire. El backend simulado genera lecturas deterministas por minuto y los dashboards estructural y de consumos.

**Tech Stack:** Lo de los Planes 1–2 + `echarts@^5.6` (importación modular `echarts/core`), Web Workers de Vite.

**Spec:** `docs/superpowers/specs/2026-10-02-gemelo-digital-front-design.md` (§5.3, §6.1–§6.3, §8.1, §9.2, §10.1, §11)

**Punto de partida:** `main` en `6d8b123` (Planes 1 y 2 completos). Interfaces existentes que este plan usa tal cual:
- `createApi(http).dashboard.{structural,consumption,comfortAdmin,comfortResidente}`, `sensors.{list,readings}`.
- Tipos `Sensor`, `SensorList`, `Reading`, `DashboardStructural`, `DashboardConsumption`, `ComfortAdmin`, `ComfortResidente`, `isAdminAlert` (`@gd/api`).
- `buildSensorStatusMap`, `SensorStatus`, `StatusLevel`, `clampScore`, `healthBand`, `formatNumber`, `formatDateTime`, `formatRelative`, `parseTimestamp` (`@gd/domain`).
- `queryKeys`, `POLL_INTERVALS_MS`, `useAlerts`, `useAckAlert`, `useApi` (`@gd/query`).
- `DataState`, `StatusBadge`, `STATUS_META`, `KpiCard`, `Button`, `useNow`, `useSession`, `RouteErrorBoundary`, `RealtimeProvider` y `test/renderApp.tsx` (`createTestServices`, `loginAs`, `renderApp`) y `test/homeReady.ts` (`apps/web`).
- `categoryLabel` (`apps/web/src/features/alerts/alertCopy.ts`).
- Mocks: `db`, `getSensors`, `resetDb`, `authenticate`, `requireRole`, `errorResponse`, escenarios `sano|critico|caido|vacio`.

**Pendientes del Plan 2 que este plan cierra:** filtros por sensor y fechas del centro de alertas (§10.1); invalidar `dashboard/structural` desde `RealtimeProvider.handleAlert`; invalidar `sensors` y `dashboard/structural` en `useAckAlert.onSettled`; comprobación a 390 px de las páginas nuevas.

## Global Constraints

- Todo lo de los Planes 1–2 sigue vigente: UI en español (Colombia); nunca "diagnóstico", "predicción" ni "riesgo de colapso"; fechas en `America/Bogota` con `es-CO`; TypeScript `strict` + `noUncheckedIndexedAccess`; prohibido `any` explícito y `dangerouslySetInnerHTML`; `packages/*` no usa globales del navegador.
- El RESIDENTE solo ve Calidad del aire con la etiqueta (Buena/Regular/Mala) por zona: nunca ppm, series, sensores ni enlaces a detalle. Las rutas `/estructural`, `/consumos`, `/sensores` siguen solo para ADMIN.
- Los umbrales de CO₂ no se codifican en el front: la etiqueta viene del backend (`index`).
- Toda gráfica tiene `role="img"` con nombre accesible y una alternativa "Ver como tabla". El estado nunca se comunica solo con color (leyenda/etiquetas de texto).
- El texto que viene del backend (nombres de sensores, zonas) nunca se interpola sin escapar en HTML de *tooltips* de ECharts.
- Series: rangos `1h`, `24h`, `7d`, `30d`; tramos diarios alineados a UTC; los tramos cerrados no se vuelven a pedir; reducción a ~1.500 puntos por serie (min/max para acelerómetros, LTTB para el resto); tope de 200.000 lecturas por rango con aviso y opción de rango menor.
- `variation_pct: null` se muestra como "Sin datos del periodo anterior", nunca como 0 %.
- Un sensor sin reporte > 15 min se muestra como "Sin datos desde …" y nunca como normal (también en la densidad por zona).
- ECharts se importa de forma modular (`echarts/core` + componentes usados) y se carga de forma diferida; el bundle inicial no lo incluye.
- Contraste AA en claro y oscuro; objetivos ≥44 px; sin desplazamiento horizontal a 390 px.

## Review Focus

1. **Series que cruzan la medianoche UTC** o lecturas repetidas en el borde de dos tramos: sin puntos duplicados ni huecos, claves de caché estables durante el día. → tests en Task 1, Task 2 y Task 4.
2. **Sensor sin datos o sin lecturas en el rango**: el panel dice "Sin lecturas en este rango." y el estado "Sin datos desde …"; nunca una línea plana que parezca normal. → tests en Task 8.
3. **`variation_pct` nulo, cero o negativo**: "Sin datos del periodo anterior", "Igual que…", "↓ …"; nunca "0 %" para `null`. → tests en Task 3 y Task 10.
4. **Rangos enormes o sin Web Worker**: aviso "demasiadas lecturas" con botón al rango menor; sin Worker se reduce en el hilo principal y la vista sigue funcionando. → tests en Task 4, Task 7 y Task 8.
5. **Parámetros de URL maliciosos** (`?sensor=`, `?rango=`, `?zona=`, `?desde=`, `?hasta=`) y **residente en `/aire`**: se ignoran los inválidos; el residente nunca ve ppm ni enlaces a series. → tests en Task 8, Task 9, Task 10 y Task 11.

---

## Estructura de archivos

```
packages/
├─ domain/src/   timeRange.ts · series.ts · downsample.ts · consumption.ts · density.ts · comfort.ts (+tests)
│                format.ts (formatDate, formatAxisTick)
└─ query/src/    keys.ts · hooks.ts (dashboards, sensores) · readings.ts (+tests) · mutations.ts (invalidaciones)
apps/web/src/
├─ ui/chart/     echartsLoader.ts · EChart.tsx · palette.ts · timeSeriesOption.ts · barOptions.ts
│                SeriesTable.tsx · RangeSelector.tsx · Chart.module.css (+tests)
├─ features/series/   downsample.worker.ts · downsampleTask.ts · useDownsampledSeries.ts
│                     SensorSeriesPanel.tsx · seriesCopy.ts · Series.module.css (+tests)
├─ features/sensors/  sensorView.ts · useSensorSelection.ts · SensorDetailPanel.tsx · SensorsPage.tsx
│                     sensorFilters.ts · ZoneDensityCard.tsx · Sensors.module.css (+tests)
├─ features/structural/ StructuralPage.tsx (+test)
├─ features/consumption/ ConsumptionPage.tsx (+test)
├─ features/comfort/    ComfortPage.tsx · comfortCopy.ts (+test)
├─ features/home/       HomeDensity.tsx (HomePage lo usa para ADMIN)
├─ features/alerts/     alertFilters.ts · AlertFiltersBar.tsx · AlertsPage.tsx (filtros sensor/fechas)
├─ features/realtime/   RealtimeProvider.tsx (invalida dashboard/structural)
├─ mocks/        readings.ts · handlers/sensors.ts (lecturas) · handlers/dashboard.ts (structural, consumption)
├─ app/          routes.tsx
└─ test/         setup.ts (mock del cargador de ECharts) · renderApp.tsx (renderInApp)
apps/web/e2e/    sensors.spec.ts · dashboards.spec.ts · mobile-pages.spec.ts
```

---

### Task 1: Rangos de tiempo, tramos diarios y fechas de Bogotá

**Files:**
- Create: `packages/domain/src/timeRange.ts`, `packages/domain/src/timeRange.test.ts`
- Modify: `packages/domain/src/format.ts`, `packages/domain/src/format.test.ts`, `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `formatDateTime`/`LOCALE`/`TIME_ZONE`/`EMPTY_VALUE` (format.ts), `parseTimestamp`.
- Produces:
  - `RANGE_KEYS = ['1h','24h','7d','30d']`, `type RangeKey`, `DEFAULT_RANGE: RangeKey = '24h'`, `DAY_MS`, `RANGE_MS: Record<RangeKey, number>`, `isRangeKey(v: unknown): v is RangeKey`, `shorterRange(key): RangeKey | null`
  - `interface TimeWindow { from: number; to: number }` (epoch ms); `rangeWindow(key, now: number): TimeWindow`
  - `interface ReadingsChunk { desde: string; hasta: string; closed: boolean }`; `dailyChunks(window: TimeWindow, now: number): ReadingsChunk[]` — días UTC `[00:00Z, 00:00Z del día siguiente)` que tocan la ventana, de más antiguo a más reciente; `closed` = el día ya terminó.
  - `bogotaDayStart(date: string): number | null` (`YYYY-MM-DD` → instante de 00:00 en Bogotá; `null` si es inválida); `bogotaDateRange(desde?: string, hasta?: string): { from: number | null; to: number | null }` (`to` exclusivo = inicio del día siguiente a `hasta`)
  - `formatDate(iso): string` ("2 oct 2026"); `formatAxisTick(ms: number, spanMs: number): string` (hora si el tramo ≤ 2 días; si no, "2 oct")

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/timeRange.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  bogotaDateRange,
  bogotaDayStart,
  dailyChunks,
  isRangeKey,
  rangeWindow,
  shorterRange,
} from './timeRange';

const NOW = Date.parse('2026-10-02T15:00:00Z');

describe('rangos', () => {
  it('valida las claves', () => {
    expect(isRangeKey('7d')).toBe(true);
    expect(isRangeKey('2h')).toBe(false);
    expect(isRangeKey(null)).toBe(false);
  });
  it('el rango menor de 30d es 7d y 1h no tiene menor', () => {
    expect(shorterRange('30d')).toBe('7d');
    expect(shorterRange('1h')).toBeNull();
  });
  it('la ventana termina ahora', () => {
    expect(rangeWindow('24h', NOW)).toEqual({ from: NOW - DAY_MS, to: NOW });
  });
});

describe('dailyChunks', () => {
  it('24 h que cruzan la medianoche UTC usan dos días; el de hoy queda abierto', () => {
    expect(dailyChunks(rangeWindow('24h', NOW), NOW)).toEqual([
      { desde: '2026-10-01T00:00:00.000Z', hasta: '2026-10-02T00:00:00.000Z', closed: true },
      { desde: '2026-10-02T00:00:00.000Z', hasta: '2026-10-03T00:00:00.000Z', closed: false },
    ]);
  });
  it('1 h dentro del día usa un solo tramo', () => {
    expect(dailyChunks(rangeWindow('1h', NOW), NOW)).toHaveLength(1);
  });
  it('7 días usan 8 tramos y las claves no cambian dentro del mismo día', () => {
    const first = dailyChunks(rangeWindow('7d', NOW), NOW);
    const later = dailyChunks(rangeWindow('7d', NOW + 3_600_000), NOW + 3_600_000);
    expect(first).toHaveLength(8);
    expect(later.map((c) => c.desde)).toEqual(first.map((c) => c.desde));
  });
});

describe('fechas de Bogotá', () => {
  it('el inicio del día en Bogotá es a las 05:00Z', () => {
    expect(bogotaDayStart('2026-10-02')).toBe(Date.parse('2026-10-02T05:00:00Z'));
  });
  it('rechaza fechas inválidas', () => {
    expect(bogotaDayStart('2026-02-30')).toBeNull();
    expect(bogotaDayStart('02/10/2026')).toBeNull();
    expect(bogotaDayStart('2026-10-2')).toBeNull();
  });
  it('el rango incluye todo el día "hasta"', () => {
    expect(bogotaDateRange('2026-10-01', '2026-10-02')).toEqual({
      from: Date.parse('2026-10-01T05:00:00Z'),
      to: Date.parse('2026-10-03T05:00:00Z'),
    });
    expect(bogotaDateRange(undefined, 'basura')).toEqual({ from: null, to: null });
  });
});
```

Añadir a `packages/domain/src/format.test.ts` (sin tocar lo existente):
```ts
import { formatAxisTick, formatDate } from './format';

describe('formatDate / formatAxisTick', () => {
  const n = (s: string) => s.replace(/\s/g, ' ');
  it('fecha corta en Bogotá', () => {
    expect(n(formatDate('2026-10-03T03:00:00Z'))).toMatch(/^2 (de )?oct\.? (de )?2026$/);
    expect(formatDate(null)).toBe('—');
  });
  it('hora para tramos cortos y día para tramos largos', () => {
    const ms = Date.parse('2026-10-02T20:45:00Z');
    expect(n(formatAxisTick(ms, 3_600_000))).toMatch(/^3:45 p\. ?m\.$/);
    expect(n(formatAxisTick(ms, 7 * 86_400_000))).toMatch(/^2 (de )?oct\.?$/);
  });
});
```
(Si `format.test.ts` no importa `describe/expect/it` en ese punto, reutilizar los imports existentes del archivo.)

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/domain test`
Expected: FAIL — no se resuelve `./timeRange`; `formatDate`/`formatAxisTick` no existen.

- [ ] **Step 3: Implementar**

`packages/domain/src/timeRange.ts`:
```ts
export const RANGE_KEYS = ['1h', '24h', '7d', '30d'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const DEFAULT_RANGE: RangeKey = '24h';

const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export const RANGE_MS: Record<RangeKey, number> = {
  '1h': HOUR_MS,
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
};

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === 'string' && (RANGE_KEYS as readonly string[]).includes(value);
}

export function shorterRange(key: RangeKey): RangeKey | null {
  const index = RANGE_KEYS.indexOf(key);
  return index > 0 ? (RANGE_KEYS[index - 1] ?? null) : null;
}

export interface TimeWindow {
  from: number;
  to: number;
}

export function rangeWindow(key: RangeKey, now: number): TimeWindow {
  return { from: now - RANGE_MS[key], to: now };
}

export interface ReadingsChunk {
  desde: string;
  hasta: string;
  /** El día ya terminó: sus lecturas no cambian y se pueden cachear para siempre. */
  closed: boolean;
}

/** Días UTC que tocan la ventana. Claves estables durante el día para que la caché funcione. */
export function dailyChunks(window: TimeWindow, now: number): ReadingsChunk[] {
  const chunks: ReadingsChunk[] = [];
  for (let start = Math.floor(window.from / DAY_MS) * DAY_MS; start < window.to; start += DAY_MS) {
    const end = start + DAY_MS;
    chunks.push({ desde: new Date(start).toISOString(), hasta: new Date(end).toISOString(), closed: end <= now });
  }
  return chunks;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Bogotá es UTC−5 todo el año (sin horario de verano). */
const BOGOTA_OFFSET_MS = 5 * HOUR_MS;

export function bogotaDayStart(date: string): number | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return utcMidnight + BOGOTA_OFFSET_MS;
}

export function bogotaDateRange(desde?: string, hasta?: string): { from: number | null; to: number | null } {
  const from = desde ? bogotaDayStart(desde) : null;
  const toStart = hasta ? bogotaDayStart(hasta) : null;
  return { from, to: toStart === null ? null : toStart + DAY_MS };
}
```

Añadir a `packages/domain/src/format.ts` (debajo de los formateadores existentes):
```ts
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });

const TWO_DAYS_MS = 2 * 24 * 3_600_000;

export function formatDate(iso: string | null | undefined): string {
  const date = parseTimestamp(iso);
  return date ? dateFormat.format(date) : EMPTY_VALUE;
}

/** Etiqueta de eje de tiempo en hora de Bogotá: hora para tramos de hasta 2 días; día y mes para tramos mayores. */
export function formatAxisTick(ms: number, spanMs: number): string {
  const date = new Date(ms);
  return spanMs <= TWO_DAYS_MS ? timeFormat.format(date) : dayMonthFormat.format(date);
}
```

Añadir a `packages/domain/src/index.ts`:
```ts
export * from './timeRange';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/domain test; pnpm --filter @gd/domain typecheck; pnpm lint`
Expected: PASS. Si una regex de Intl falla solo por la forma exacta del texto en Node 24, ajustar la regex del test (no la implementación) y anotarlo.

- [ ] **Step 5: Commit**

```
git add packages/domain
git commit -m "feat(domain): rangos de tiempo, tramos diarios y fechas de Bogotá"
```

---

### Task 2: Series y reducción (LTTB y min/max)

**Files:**
- Create: `packages/domain/src/series.ts`, `packages/domain/src/series.test.ts`
- Create: `packages/domain/src/downsample.ts`, `packages/domain/src/downsample.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `TimeWindow` (Task 1), `parseTimestamp`.
- Produces:
  - `type SeriesPoint = [number, number]` (`[epoch ms, valor]`); `type SeriesMap = Record<string, SeriesPoint[]>`
  - `interface ReadingLike { timestamp: string; values: Record<string, number | null> }`
  - `readingsToSeries(readings: readonly ReadingLike[], window?: TimeWindow): SeriesMap` — descarta nulos, no finitos y fechas inválidas; recorta a la ventana; ordena ascendente; mismo instante repetido → queda el último.
  - `measuredChange(points: readonly SeriesPoint[]): number | null` (último − primero; `null` con menos de 2 puntos); `countPoints(series: SeriesMap): number`
  - `TARGET_POINTS = 1500`; `MAX_READINGS_PER_RANGE = 200_000`
  - `type DownsampleStrategy = 'lttb' | 'minmax'`; `strategyForSensorType(type: string): DownsampleStrategy` (`accelerometer` → `minmax`)
  - `lttb(points, threshold): SeriesPoint[]`; `minMaxDownsample(points, buckets): SeriesPoint[]`; `downsampleSeries(series: SeriesMap, strategy, target?: number): SeriesMap` (min/max usa `target / 2` cubetas)

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/series.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { countPoints, measuredChange, readingsToSeries } from './series';

const r = (timestamp: string, values: Record<string, number | null>) => ({ timestamp, values });

describe('readingsToSeries', () => {
  it('agrupa por clave, ordena, descarta nulos y fechas inválidas', () => {
    const series = readingsToSeries([
      r('2026-10-02T10:02:00Z', { x: 2, y: null }),
      r('no-es-fecha', { x: 99 }),
      r('2026-10-02T10:01:00Z', { x: 1, y: 5 }),
      r('2026-10-02T10:03:00Z', { x: Number.NaN, y: 6 }),
    ]);
    expect(series.x).toEqual([
      [Date.parse('2026-10-02T10:01:00Z'), 1],
      [Date.parse('2026-10-02T10:02:00Z'), 2],
    ]);
    expect(series.y?.map((p) => p[1])).toEqual([5, 6]);
  });

  it('una lectura repetida en el borde de dos tramos no se duplica (gana la última)', () => {
    const series = readingsToSeries([r('2026-10-02T00:00:00Z', { x: 1 }), r('2026-10-02T00:00:00Z', { x: 3 })]);
    expect(series.x).toEqual([[Date.parse('2026-10-02T00:00:00Z'), 3]]);
  });

  it('recorta a la ventana', () => {
    const window = { from: Date.parse('2026-10-02T10:00:00Z'), to: Date.parse('2026-10-02T11:00:00Z') };
    const series = readingsToSeries([r('2026-10-02T09:59:00Z', { x: 1 }), r('2026-10-02T10:30:00Z', { x: 2 })], window);
    expect(series.x?.map((p) => p[1])).toEqual([2]);
  });
});

describe('measuredChange / countPoints', () => {
  it('último menos primero', () => {
    expect(measuredChange([[1, 0.4], [2, 0.5], [3, 0.7]])).toBeCloseTo(0.3);
    expect(measuredChange([[1, 0.4]])).toBeNull();
  });
  it('cuenta todos los puntos', () => {
    expect(countPoints({ a: [[1, 1]], b: [[1, 1], [2, 2]] })).toBe(3);
  });
});
```

`packages/domain/src/downsample.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { downsampleSeries, lttb, minMaxDownsample, strategyForSensorType } from './downsample';
import type { SeriesPoint } from './series';

function flatWithSpike(n: number, spikeAt: number): SeriesPoint[] {
  return Array.from({ length: n }, (_, i): SeriesPoint => [i * 60_000, i === spikeAt ? 10 : Math.sin(i / 50) * 0.01]);
}

describe('lttb', () => {
  it('devuelve exactamente el umbral, conserva extremos y el pico', () => {
    const points = flatWithSpike(10_000, 4321);
    const out = lttb(points, 500);
    expect(out).toHaveLength(500);
    expect(out[0]).toEqual(points[0]);
    expect(out.at(-1)).toEqual(points.at(-1));
    expect(out.some((p) => p[1] === 10)).toBe(true);
  });
  it('si hay menos puntos que el umbral devuelve una copia', () => {
    const points = flatWithSpike(10, 3);
    const out = lttb(points, 500);
    expect(out).toEqual(points);
    expect(out).not.toBe(points);
  });
});

describe('minMaxDownsample', () => {
  it('conserva el pico, respeta el orden temporal y el límite de puntos', () => {
    const points = flatWithSpike(43_200, 20_000);
    const out = minMaxDownsample(points, 750);
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.some((p) => p[1] === 10)).toBe(true);
    for (let i = 1; i < out.length; i++) expect(out[i]![0]).toBeGreaterThanOrEqual(out[i - 1]![0]);
  });
});

describe('downsampleSeries / strategyForSensorType', () => {
  it('acelerómetros usan min/max; el resto LTTB', () => {
    expect(strategyForSensorType('accelerometer')).toBe('minmax');
    expect(strategyForSensorType('crack_meter')).toBe('lttb');
  });
  it('reduce cada serie a ~1500 puntos y no toca las cortas', () => {
    const out = downsampleSeries({ long: flatWithSpike(43_200, 1), short: flatWithSpike(100, 1) }, 'lttb');
    expect(out.long).toHaveLength(1500);
    expect(out.short).toHaveLength(100);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/domain test`
Expected: FAIL — no se resuelven `./series` ni `./downsample`.

- [ ] **Step 3: Implementar**

`packages/domain/src/series.ts`:
```ts
import { parseTimestamp } from './time';
import type { TimeWindow } from './timeRange';

export type SeriesPoint = [number, number];
export type SeriesMap = Record<string, SeriesPoint[]>;

export interface ReadingLike {
  timestamp: string;
  values: Record<string, number | null>;
}

export function readingsToSeries(readings: readonly ReadingLike[], window?: TimeWindow): SeriesMap {
  const byKey = new Map<string, Map<number, number>>();
  for (const reading of readings) {
    const time = parseTimestamp(reading.timestamp)?.getTime();
    if (time === undefined) continue;
    if (window && (time < window.from || time > window.to)) continue;
    for (const [key, value] of Object.entries(reading.values)) {
      if (value === null || !Number.isFinite(value)) continue;
      let points = byKey.get(key);
      if (!points) {
        points = new Map();
        byKey.set(key, points);
      }
      points.set(time, value); // mismo instante repetido (borde de tramos): gana el último
    }
  }
  const series: SeriesMap = {};
  for (const [key, points] of byKey) {
    series[key] = [...points.entries()].sort((a, b) => a[0] - b[0]);
  }
  return series;
}

export function measuredChange(points: readonly SeriesPoint[]): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  return last[1] - first[1];
}

export function countPoints(series: SeriesMap): number {
  return Object.values(series).reduce((total, points) => total + points.length, 0);
}
```

`packages/domain/src/downsample.ts`:
```ts
import type { SeriesMap, SeriesPoint } from './series';

/** Puntos por serie que se dibujan (spec §9.2). */
export const TARGET_POINTS = 1500;
/** Por encima de este número de lecturas por rango se ofrece un rango menor. */
export const MAX_READINGS_PER_RANGE = 200_000;

export type DownsampleStrategy = 'lttb' | 'minmax';

/** Las aceleraciones conservan picos con min/max; el resto usa LTTB. */
export function strategyForSensorType(sensorType: string): DownsampleStrategy {
  return sensorType === 'accelerometer' ? 'minmax' : 'lttb';
}

/** Largest-Triangle-Three-Buckets: conserva la forma visual con `threshold` puntos. */
export function lttb(points: readonly SeriesPoint[], threshold: number): SeriesPoint[] {
  const n = points.length;
  if (threshold >= n || threshold < 3) return points.slice();
  const sampled: SeriesPoint[] = [points[0]!];
  const every = (n - 2) / (threshold - 2);
  let anchor = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += points[j]![0];
      avgY += points[j]![1];
    }
    const avgLength = Math.max(avgEnd - avgStart, 1);
    avgX /= avgLength;
    avgY /= avgLength;

    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.floor((i + 1) * every) + 1;
    const [ax, ay] = points[anchor]!;
    let maxArea = -1;
    let next = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const [px, py] = points[j]!;
      const area = Math.abs((ax - avgX) * (py - ay) - (ax - px) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    sampled.push(points[next]!);
    anchor = next;
  }
  sampled.push(points[n - 1]!);
  return sampled;
}

/** Por cada cubeta de tiempo conserva el mínimo y el máximo (en orden temporal). */
export function minMaxDownsample(points: readonly SeriesPoint[], buckets: number): SeriesPoint[] {
  if (buckets < 1 || points.length <= buckets * 2) return points.slice();
  const first = points[0]![0];
  const last = points[points.length - 1]![0];
  const span = Math.max((last - first) / buckets, 1);
  const out: SeriesPoint[] = [];
  let index = 0;
  for (let bucket = 0; bucket < buckets; bucket++) {
    const end = bucket === buckets - 1 ? Number.POSITIVE_INFINITY : first + span * (bucket + 1);
    let min: SeriesPoint | null = null;
    let max: SeriesPoint | null = null;
    while (index < points.length && points[index]![0] < end) {
      const point = points[index]!;
      if (!min || point[1] < min[1]) min = point;
      if (!max || point[1] > max[1]) max = point;
      index++;
    }
    if (!min || !max) continue;
    if (min === max) out.push(min);
    else if (min[0] <= max[0]) out.push(min, max);
    else out.push(max, min);
  }
  return out;
}

export function downsampleSeries(series: SeriesMap, strategy: DownsampleStrategy, target: number = TARGET_POINTS): SeriesMap {
  const out: SeriesMap = {};
  for (const [key, points] of Object.entries(series)) {
    out[key] = strategy === 'minmax' ? minMaxDownsample(points, Math.floor(target / 2)) : lttb(points, target);
  }
  return out;
}
```

Añadir a `packages/domain/src/index.ts`:
```ts
export * from './series';
export * from './downsample';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/domain test; pnpm --filter @gd/domain typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add packages/domain
git commit -m "feat(domain): series de lecturas y reducción LTTB y min/max"
```

---

### Task 3: Variación de consumos, densidad por zona y tono de confort

**Files:**
- Create: `packages/domain/src/consumption.ts`, `consumption.test.ts`, `density.ts`, `density.test.ts`, `comfort.ts`, `comfort.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `formatNumber`, `SensorStatus`, `StatusLevel`.
- Produces:
  - `type VariationDirection = 'up' | 'down' | 'flat'`; `interface VariationView { text: string; direction: VariationDirection | null }`; `describeVariation(pct: number | null): VariationView`
  - `STATUS_ORDER: readonly StatusLevel[]` (`CRITICAL, WARNING, OFFLINE, INFO, OK`); `interface ZoneDensity { zone: string; total: number; counts: Record<StatusLevel, number> }`; `densityByZone(statuses: Iterable<SensorStatus>): ZoneDensity[]` (zonas en orden alfabético es)
  - `type ComfortIndex = 'BUENO' | 'REGULAR' | 'MALO'`; `COMFORT_TONE: Record<ComfortIndex, StatusLevel>` (OK / WARNING / CRITICAL)

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/consumption.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { describeVariation } from './consumption';

describe('describeVariation', () => {
  it('null o no finito: sin datos del periodo anterior, nunca 0 %', () => {
    expect(describeVariation(null)).toEqual({ text: 'Sin datos del periodo anterior', direction: null });
    expect(describeVariation(Number.NaN).direction).toBeNull();
  });
  it('subida y bajada con flecha y un decimal', () => {
    expect(describeVariation(12.24)).toEqual({ text: '↑ 12,2 % frente al mismo tramo del mes anterior', direction: 'up' });
    expect(describeVariation(-6.548)).toEqual({ text: '↓ 6,5 % frente al mismo tramo del mes anterior', direction: 'down' });
  });
  it('sin cambio', () => {
    expect(describeVariation(0.04)).toEqual({ text: 'Igual que el mismo tramo del mes anterior', direction: 'flat' });
  });
});
```

`packages/domain/src/density.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { densityByZone } from './density';
import type { SensorStatus } from './sensorStatus';

const s = (zone: string, level: SensorStatus['level']): SensorStatus => ({
  sensorId: `${zone}-${level}-${Math.random()}`,
  level,
  lastSeenAt: null,
  zone,
  category: 'structural',
});

describe('densityByZone', () => {
  it('cuenta por zona y estado, en orden alfabético', () => {
    const result = densityByZone([s('Sótano', 'OK'), s('Lobby', 'OFFLINE'), s('Sótano', 'CRITICAL'), s('Sótano', 'OK')]);
    expect(result.map((z) => z.zone)).toEqual(['Lobby', 'Sótano']);
    expect(result[1]).toMatchObject({ total: 3, counts: { OK: 2, CRITICAL: 1, OFFLINE: 0, WARNING: 0, INFO: 0 } });
    expect(result[0]?.counts.OFFLINE).toBe(1);
  });
  it('sin sensores no hay zonas', () => {
    expect(densityByZone([])).toEqual([]);
  });
});
```

`packages/domain/src/comfort.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { COMFORT_TONE } from './comfort';

describe('COMFORT_TONE', () => {
  it('mapea el índice del backend a un estado visual', () => {
    expect(COMFORT_TONE).toEqual({ BUENO: 'OK', REGULAR: 'WARNING', MALO: 'CRITICAL' });
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/domain test`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 3: Implementar**

`packages/domain/src/consumption.ts`:
```ts
import { formatNumber } from './format';

export type VariationDirection = 'up' | 'down' | 'flat';

export interface VariationView {
  text: string;
  direction: VariationDirection | null;
}

/** Variación del mes en curso frente al mismo tramo del mes anterior (spec §6.2). */
export function describeVariation(pct: number | null): VariationView {
  if (pct === null || !Number.isFinite(pct)) return { text: 'Sin datos del periodo anterior', direction: null };
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return { text: 'Igual que el mismo tramo del mes anterior', direction: 'flat' };
  const up = rounded > 0;
  return {
    text: `${up ? '↑' : '↓'} ${formatNumber(Math.abs(rounded))} % frente al mismo tramo del mes anterior`,
    direction: up ? 'up' : 'down',
  };
}
```

`packages/domain/src/density.ts`:
```ts
import type { StatusLevel } from './levels';
import type { SensorStatus } from './sensorStatus';

/** Orden de los estados en la densidad: los que piden atención primero. */
export const STATUS_ORDER: readonly StatusLevel[] = ['CRITICAL', 'WARNING', 'OFFLINE', 'INFO', 'OK'];

export interface ZoneDensity {
  zone: string;
  total: number;
  counts: Record<StatusLevel, number>;
}

export function densityByZone(statuses: Iterable<SensorStatus>): ZoneDensity[] {
  const zones = new Map<string, ZoneDensity>();
  for (const status of statuses) {
    let zone = zones.get(status.zone);
    if (!zone) {
      zone = { zone: status.zone, total: 0, counts: { CRITICAL: 0, WARNING: 0, INFO: 0, OK: 0, OFFLINE: 0 } };
      zones.set(status.zone, zone);
    }
    zone.total += 1;
    zone.counts[status.level] += 1;
  }
  return [...zones.values()].sort((a, b) => a.zone.localeCompare(b.zone, 'es'));
}
```

`packages/domain/src/comfort.ts`:
```ts
import type { StatusLevel } from './levels';

export type ComfortIndex = 'BUENO' | 'REGULAR' | 'MALO';

/** La etiqueta la decide el backend; el front solo la traduce a un estado visual (spec §6.2). */
export const COMFORT_TONE: Record<ComfortIndex, StatusLevel> = {
  BUENO: 'OK',
  REGULAR: 'WARNING',
  MALO: 'CRITICAL',
};
```

Añadir a `packages/domain/src/index.ts`:
```ts
export * from './consumption';
export * from './density';
export * from './comfort';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/domain test; pnpm --filter @gd/domain typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add packages/domain
git commit -m "feat(domain): variación de consumos, densidad por zona y tono de confort"
```

---

### Task 4: Hooks de dashboards, sensores y lecturas por tramos (`@gd/query`)

**Files:**
- Modify: `packages/query/src/keys.ts`, `packages/query/src/hooks.ts`, `packages/query/src/mutations.ts`, `packages/query/src/index.ts`
- Create: `packages/query/src/readings.ts`, `packages/query/src/readings.test.tsx`, `packages/query/src/dashboards.test.tsx`
- Modify: `packages/query/src/mutations.test.tsx` (solo añadir un test)
- Modify: `packages/query/package.json` (dependencia `@gd/domain`)

**Interfaces:**
- Consumes: `Api`, `Reading`, `Role`, tipos de dashboards (`@gd/api`); `RangeKey`, `rangeWindow`, `dailyChunks`, `MAX_READINGS_PER_RANGE`, `TimeWindow` (`@gd/domain`).
- Produces:
  - `queryKeys.dashboard.structural()`, `.consumption()`, `.comfort(role)`; `queryKeys.readings.all()` = `['gd','readings']`, `queryKeys.readings.chunk(sensorId, desde, hasta)` (raíz separada de `sensors` para que invalidar la lista de sensores no vuelva a pedir las lecturas)
  - `useDashboardStructural(): UseQueryResult<DashboardStructural>`; `useDashboardConsumption(): UseQueryResult<DashboardConsumption>`; `useComfort(role: Role): UseQueryResult<ComfortResidente>` (ADMIN pide `comfortAdmin`; la forma común no tiene `ppm`); `useSensors(options?: { enabled?: boolean }): UseQueryResult<SensorList>`
  - `interface SensorReadings { readings: Reading[]; window: TimeWindow; isPending: boolean; isError: boolean; error: unknown; dataUpdatedAt: number; tooMany: boolean; refetch(): void }`; `useSensorReadings(sensorId: string | null, range: RangeKey): SensorReadings` — un `useQuery` por tramo diario; tramo cerrado `staleTime: Infinity` y sin polling; tramo abierto refresca cada `POLL_INTERVALS_MS.sensors`; `readings` mantiene la misma identidad mientras los datos no cambien.
  - `useAckAlert.onSettled` invalida además `sensors.list()` y `dashboard.structural()`.

- [ ] **Step 1: Añadir la dependencia**

Run: `pnpm --filter @gd/query add @gd/domain@workspace:*`

- [ ] **Step 2: Escribir los tests que fallan**

`packages/query/src/readings.test.tsx`:
```tsx
import type { Api, Reading } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { useSensorReadings } from './readings';

const NOW = new Date('2026-10-02T15:00:00Z');

function setup() {
  const readings = vi.fn(async (_id: string, range: { desde?: string; hasta?: string }): Promise<Reading[]> => [
    { timestamp: range.desde ?? '', unit: 'g', values: { x: 1 }, battery_pct: 90 },
  ]);
  const api = { sensors: { readings } } as unknown as Api;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { readings, wrapper, client };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSensorReadings', () => {
  it('pide un tramo por día UTC y junta las lecturas', async () => {
    const { readings, wrapper } = setup();
    const { result } = renderHook(() => useSensorReadings('acc-1', '24h'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(readings).toHaveBeenCalledTimes(2);
    expect(readings.mock.calls.map((c) => c[1])).toEqual([
      { desde: '2026-10-01T00:00:00.000Z', hasta: '2026-10-02T00:00:00.000Z' },
      { desde: '2026-10-02T00:00:00.000Z', hasta: '2026-10-03T00:00:00.000Z' },
    ]);
    expect(result.current.readings).toHaveLength(2);
    expect(result.current.tooMany).toBe(false);
  });

  it('al ampliar el rango reutiliza los tramos ya pedidos', async () => {
    const { readings, wrapper } = setup();
    const { result, rerender } = renderHook(({ range }: { range: '24h' | '7d' }) => useSensorReadings('acc-1', range), {
      wrapper,
      initialProps: { range: '24h' },
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(readings).toHaveBeenCalledTimes(8);
  });

  it('la lista de lecturas conserva su identidad si los datos no cambian', async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => useSensorReadings('acc-1', '24h'), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    const first = result.current.readings;
    rerender();
    expect(result.current.readings).toBe(first);
  });

  it('sin sensor no pide nada', () => {
    const { readings, wrapper } = setup();
    const { result } = renderHook(() => useSensorReadings(null, '24h'), { wrapper });
    expect(readings).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
    expect(result.current.readings).toEqual([]);
  });
});
```

`packages/query/src/dashboards.test.tsx`:
```tsx
import type { Api } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { useComfort, useSensors } from './hooks';

function wrap(api: Api) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('hooks de dashboards', () => {
  it('useComfort usa el endpoint del rol', async () => {
    const comfortAdmin = vi.fn().mockResolvedValue({ zones: [] });
    const comfortResidente = vi.fn().mockResolvedValue({ zones: [] });
    const api = { dashboard: { comfortAdmin, comfortResidente } } as unknown as Api;
    const { result } = renderHook(() => useComfort('RESIDENTE'), { wrapper: wrap(api) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(comfortResidente).toHaveBeenCalled();
    expect(comfortAdmin).not.toHaveBeenCalled();
  });

  it('useSensors no pide nada si está deshabilitado', () => {
    const list = vi.fn();
    const api = { sensors: { list } } as unknown as Api;
    renderHook(() => useSensors({ enabled: false }), { wrapper: wrap(api) });
    expect(list).not.toHaveBeenCalled();
  });
});
```

Añadir a `packages/query/src/mutations.test.tsx` (sin tocar los tests existentes):
```tsx
  it('al terminar invalida también sensores y el dashboard estructural', async () => {
    const { client, wrapper } = setup(async () => ({ ...pendingAlert, acknowledged: true }));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useAckAlert(), { wrapper });
    act(() => result.current.mutate(pendingAlert.alert_id));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.sensors.list() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.structural() });
  });
```
(dentro del `describe('useAckAlert', …)` existente; usa los helpers `setup` y `pendingAlert` del archivo).

- [ ] **Step 3: Correr y verificar que fallan**

Run: `pnpm --filter @gd/query test`
Expected: FAIL — no se resuelve `./readings`; `useComfort`/`useSensors` no existen; `queryKeys.dashboard.structural` no existe.

- [ ] **Step 4: Implementar**

`packages/query/src/keys.ts`:
```ts
import type { AlertFilters, Role } from '@gd/api';

export const queryKeys = {
  all: ['gd'] as const,
  dashboard: {
    general: () => ['gd', 'dashboard', 'general'] as const,
    structural: () => ['gd', 'dashboard', 'structural'] as const,
    consumption: () => ['gd', 'dashboard', 'consumption'] as const,
    comfort: (role: Role) => ['gd', 'dashboard', 'comfort', role] as const,
  },
  alerts: {
    all: () => ['gd', 'alerts'] as const,
    list: (role: Role, filters: AlertFilters) => ['gd', 'alerts', role, filters] as const,
  },
  sensors: {
    list: () => ['gd', 'sensors'] as const,
  },
  /** Raíz propia: invalidar la lista de sensores no debe volver a pedir las lecturas. */
  readings: {
    all: () => ['gd', 'readings'] as const,
    chunk: (sensorId: string, desde: string, hasta: string) => ['gd', 'readings', sensorId, desde, hasta] as const,
  },
};
```

Añadir a `packages/query/src/hooks.ts`:
```ts
import type { ComfortResidente, DashboardConsumption, DashboardStructural, SensorList } from '@gd/api';

export function useDashboardStructural(): UseQueryResult<DashboardStructural> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.structural(),
    queryFn: ({ signal }) => api.dashboard.structural(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardStructural,
  });
}

export function useDashboardConsumption(): UseQueryResult<DashboardConsumption> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.consumption(),
    queryFn: ({ signal }) => api.dashboard.consumption(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardConsumption,
  });
}

/** Confort con la forma común (sin `ppm`); el ADMIN recibe además `ppm` en runtime. */
export function useComfort(role: Role): UseQueryResult<ComfortResidente> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.comfort(role),
    queryFn: ({ signal }): Promise<ComfortResidente> =>
      role === 'ADMIN' ? api.dashboard.comfortAdmin(signal) : api.dashboard.comfortResidente(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardComfort,
  });
}

export function useSensors(options: { enabled?: boolean } = {}): UseQueryResult<SensorList> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.sensors.list(),
    queryFn: ({ signal }) => api.sensors.list(signal),
    refetchInterval: POLL_INTERVALS_MS.sensors,
    enabled: options.enabled ?? true,
  });
}
```
(unificar los imports de tipos de `@gd/api` en una sola línea al inicio del archivo).

`packages/query/src/readings.ts`:
```ts
import type { Reading } from '@gd/api';
import { MAX_READINGS_PER_RANGE, dailyChunks, rangeWindow, type RangeKey, type TimeWindow } from '@gd/domain';
import { useQueries } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { useApi } from './ApiContext';
import { POLL_INTERVALS_MS } from './intervals';
import { queryKeys } from './keys';

export interface SensorReadings {
  readings: Reading[];
  window: TimeWindow;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  dataUpdatedAt: number;
  tooMany: boolean;
  refetch: () => void;
}

const EMPTY: Reading[] = [];

/** Lecturas por tramos diarios: los días cerrados se cachean para siempre y el día en curso se refresca. */
export function useSensorReadings(sensorId: string | null, range: RangeKey): SensorReadings {
  const api = useApi();
  const now = Date.now();
  const window = rangeWindow(range, now);
  const chunks = sensorId ? dailyChunks(window, now) : [];

  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: queryKeys.readings.chunk(sensorId ?? '', chunk.desde, chunk.hasta),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.sensors.readings(sensorId ?? '', { desde: chunk.desde, hasta: chunk.hasta }, signal),
      staleTime: chunk.closed ? Number.POSITIVE_INFINITY : 0,
      refetchInterval: chunk.closed ? (false as const) : POLL_INTERVALS_MS.sensors,
    })),
  });

  // Identidad estable de `readings` mientras ningún tramo cambie (evita recalcular series y reenviar al Worker).
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const version = results.map((r) => `${r.dataUpdatedAt}:${r.data ? 1 : 0}`).join('|');
  const readings = useMemo(() => {
    const merged = resultsRef.current.flatMap((r) => r.data ?? []);
    return merged.length === 0 ? EMPTY : merged;
  }, [version]);

  return {
    readings,
    window,
    isPending: results.some((r) => r.isPending),
    isError: results.some((r) => r.isError && r.data === undefined),
    error: results.find((r) => r.isError)?.error ?? null,
    dataUpdatedAt: results.reduce((latest, r) => Math.max(latest, r.dataUpdatedAt), 0),
    tooMany: readings.length > MAX_READINGS_PER_RANGE,
    refetch: () => {
      for (const r of resultsRef.current) void r.refetch();
    },
  };
}
```

En `packages/query/src/mutations.ts`, ampliar `onSettled`:
```ts
    onSettled: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() }),
        // El estado de cada sensor depende de sus alertas sin revisar (spec §5.3).
        queryClient.invalidateQueries({ queryKey: queryKeys.sensors.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.structural() }),
      ]);
    },
```

Añadir a `packages/query/src/index.ts`:
```ts
export * from './readings';
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/query test; pnpm --filter @gd/query typecheck; pnpm lint`
Expected: PASS, salida limpia. Si `react-hooks/exhaustive-deps` advierte sobre `version` en el `useMemo`, mantener el patrón (es intencional: la dependencia real es la versión de los datos) y documentarlo en un comentario; no desactivar la regla globalmente.

- [ ] **Step 6: Commit**

```
git add packages/query pnpm-lock.yaml
git commit -m "feat(query): dashboards, sensores y lecturas por tramos diarios"
```

---

### Task 5: Backend simulado — lecturas, estructural y consumos

**Files:**
- Create: `apps/web/src/mocks/readings.ts`, `apps/web/src/mocks/readings.test.ts`
- Modify: `apps/web/src/mocks/handlers/sensors.ts`, `apps/web/src/mocks/handlers/dashboard.ts`

**Interfaces:**
- Consumes: `db`, `getSensors`, `authenticate`, `requireRole`, `errorResponse`; `Sensor`, `Reading`, `AlertAdmin`; `isOffline`, `mostSevere`.
- Produces:
  - `generateReadings(sensor: Sensor, options: { from: number; to: number; offlineSince: number | null; spikes: { t: number; value: number }[] }): Reading[]` — una lectura por minuto en `[from, min(to, offlineSince))`, valores deterministas por tipo (`accelerometer` {x,y,z}, `inclinometer` {x,y}, `crack_meter` {width} con tendencia creciente, `water_flow` {flow}, `power` {power}, `co2` {co2}), y el valor de la alerta en ±5 min de cada alerta CRITICAL/WARNING del sensor.
  - `GET */api/v1/sensors/:id/data?desde&hasta` (ADMIN; 404 si no existe; `desde ≥ hasta` o fechas inválidas → 422 `VALIDATION_ERROR`; ventana > 31 días → 422; por defecto últimas 24 h; nunca lecturas futuras; sensores sin datos dejan de reportar hace 40 min). Responde un arreglo.
  - `GET */api/v1/dashboard/structural` (ADMIN): `structural_score = max(0, 100 − (25·crít + 10·adv + 2·info + 5·offline))` solo sobre sensores estructurales y sus alertas abiertas; `sensors_in_alert` agrupa alertas abiertas por sensor estructural (nivel más severo, conteo). **Sano 100, crítico 60, caído 70, vacío 100.**
  - `GET */api/v1/dashboard/consumption` (ADMIN): periodo desde el 1 del mes en Bogotá hasta ahora; `by_unit`: `m³` (1234.5 / 1100.2 / 12.2) y `kWh` (8420 / 9010 / −6.5); en **caído** `kWh` llega con `previous_period: null` y `variation_pct: null`; en **vacío** `by_unit: []`.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/src/mocks/readings.test.ts`:
```ts
import { MemoryTokenStore, createApi, createHttpClient, createSessionManager } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { generateReadings } from './readings';
import { ADMIN_EMAIL, DEMO_PASSWORD, RESIDENTE_EMAIL } from './seed';

const BASE = 'http://localhost';

async function apiAs(email: string) {
  const session = createSessionManager({ baseUrl: BASE, store: new MemoryTokenStore() });
  const http = createHttpClient({
    baseUrl: BASE,
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refresh(),
    validation: 'strict',
  });
  await session.login(email, DEMO_PASSWORD);
  return createApi(http);
}

function sensor(id: string) {
  const found = db.sensors.find((s) => s.sensor_id === id);
  if (!found) throw new Error(`no existe ${id}`);
  return found;
}

describe('generateReadings', () => {
  const from = Date.parse('2026-10-02T10:00:00Z');
  it('una lectura por minuto, determinista', () => {
    const a = generateReadings(sensor('acc-t1-sotano'), { from, to: from + 3_600_000, offlineSince: null, spikes: [] });
    const b = generateReadings(sensor('acc-t1-sotano'), { from, to: from + 3_600_000, offlineSince: null, spikes: [] });
    expect(a).toHaveLength(60);
    expect(a).toEqual(b);
    expect(Object.keys(a[0]?.values ?? {})).toEqual(['x', 'y', 'z']);
  });
  it('se detiene cuando el sensor deja de reportar', () => {
    const out = generateReadings(sensor('co2-gym'), { from, to: from + 3_600_000, offlineSince: from + 600_000, spikes: [] });
    expect(out).toHaveLength(10);
  });
  it('marca el valor de la alerta cerca de su instante', () => {
    const t = from + 1_800_000;
    const out = generateReadings(sensor('acc-t1-sotano'), { from, to: from + 3_600_000, offlineSince: null, spikes: [{ t, value: 0.35 }] });
    expect(out.find((r) => r.timestamp === new Date(t).toISOString())?.values.x).toBe(0.35);
  });
});

describe('handlers de lecturas y dashboards', () => {
  it('lecturas de la última hora', async () => {
    const api = await apiAs(ADMIN_EMAIL);
    const now = Date.now();
    const readings = await api.sensors.readings('water-main', {
      desde: new Date(now - 3_600_000).toISOString(),
      hasta: new Date(now).toISOString(),
    });
    expect(readings.length).toBeGreaterThanOrEqual(59);
    expect(readings.length).toBeLessThanOrEqual(60);
  });

  it('rechaza ventanas mayores a 31 días y rangos invertidos', async () => {
    const api = await apiAs(ADMIN_EMAIL);
    await expect(
      api.sensors.readings('water-main', { desde: '2026-08-01T00:00:00Z', hasta: '2026-10-02T00:00:00Z' }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      api.sensors.readings('water-main', { desde: '2026-10-02T00:00:00Z', hasta: '2026-10-01T00:00:00Z' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('el residente no puede pedir lecturas ni dashboards de administrador', async () => {
    const api = await apiAs(RESIDENTE_EMAIL);
    await expect(api.sensors.readings('water-main', {})).rejects.toMatchObject({ status: 403 });
    await expect(api.dashboard.structural()).rejects.toMatchObject({ status: 403 });
    await expect(api.dashboard.consumption()).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['sano', 100],
    ['critico', 60],
    ['caido', 70],
    ['vacio', 100],
  ] as const)('estructural en %s → %i', async (scenario, score) => {
    resetDb(scenario);
    const api = await apiAs(ADMIN_EMAIL);
    expect((await api.dashboard.structural()).structural_score).toBe(score);
  });

  it('en crítico lista los sensores estructurales en alerta', async () => {
    resetDb('critico');
    const api = await apiAs(ADMIN_EMAIL);
    const { sensors_in_alert } = await api.dashboard.structural();
    expect(sensors_in_alert).toEqual(
      expect.arrayContaining([
        { sensor_id: 'acc-t1-sotano', level: 'CRITICAL', alerts: 1 },
        { sensor_id: 'crack-t2-cubierta', level: 'WARNING', alerts: 1 },
      ]),
    );
  });

  it('consumos: variación normal y nula en caído', async () => {
    const api = await apiAs(ADMIN_EMAIL);
    const sano = await api.dashboard.consumption();
    expect(sano.by_unit).toEqual([
      { unit: 'm³', current_period: 1234.5, previous_period: 1100.2, variation_pct: 12.2 },
      { unit: 'kWh', current_period: 8420, previous_period: 9010, variation_pct: -6.5 },
    ]);
    resetDb('caido');
    const caido = await api.dashboard.consumption();
    expect(caido.by_unit[1]).toMatchObject({ unit: 'kWh', previous_period: null, variation_pct: null });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelve `./readings`; los endpoints no existen (MSW `onUnhandledRequest: 'error'`).

- [ ] **Step 3: Implementar**

`apps/web/src/mocks/readings.ts`:
```ts
import type { Reading, Sensor } from '@gd/api';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const PRIMARY_KEY: Record<string, string> = {
  accelerometer: 'x',
  inclinometer: 'x',
  crack_meter: 'width',
  water_flow: 'flow',
  power: 'power',
  co2: 'co2',
};

function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Ruido determinista en [-0.5, 0.5) a partir de una semilla y el minuto. */
function noise(seed: number, t: number): number {
  const x = Math.sin(seed * 12.9898 + (t / MIN) * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

/** Ciclo diario en [-1, 1]. */
function daily(t: number): number {
  return Math.sin(((t % DAY) / DAY) * 2 * Math.PI - Math.PI / 2);
}

function baseValues(sensor: Sensor, t: number, seed: number): Record<string, number> {
  const n = noise(seed, t);
  switch (sensor.sensor_type) {
    case 'accelerometer':
      return { x: 0.002 + n * 0.004, y: 0.001 + noise(seed + 1, t) * 0.004, z: 0.998 + noise(seed + 2, t) * 0.002 };
    case 'inclinometer':
      return { x: 0.02 + n * 0.002, y: 0.01 + noise(seed + 1, t) * 0.002 };
    case 'crack_meter':
      // Tendencia lenta y creciente para que "cambio medido en el periodo" tenga sentido.
      return { width: 0.38 + ((t / DAY) % 365) * 0.0007 + n * 0.002 };
    case 'water_flow':
      return { flow: Math.max(0, 3 + 2 * daily(t) + n) };
    case 'power':
      return { power: Math.max(0, 6 + 3 * daily(t) + n) };
    case 'co2':
      return { co2: Math.round(600 + 200 * daily(t) + n * 60) };
    default:
      return { value: n };
  }
}

export interface GenerateOptions {
  from: number;
  to: number;
  offlineSince: number | null;
  spikes: { t: number; value: number }[];
}

export function generateReadings(sensor: Sensor, options: GenerateOptions): Reading[] {
  const seed = hash(sensor.sensor_id) * 1000;
  const primary = PRIMARY_KEY[sensor.sensor_type] ?? 'value';
  const end = options.offlineSince === null ? options.to : Math.min(options.to, options.offlineSince);
  const out: Reading[] = [];
  for (let t = Math.ceil(options.from / MIN) * MIN; t < end; t += MIN) {
    const values = baseValues(sensor, t, seed);
    for (const spike of options.spikes) {
      if (Math.abs(t - spike.t) <= 5 * MIN) values[primary] = spike.value;
    }
    out.push({ timestamp: new Date(t).toISOString(), unit: sensor.unit, values, battery_pct: sensor.last_battery_pct });
  }
  return out;
}
```

En `apps/web/src/mocks/handlers/sensors.ts`, añadir el handler de lecturas (y los imports `errorResponse`, `db`, `generateReadings`):
```ts
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const MAX_WINDOW_MS = 31 * DAY;
const OFFLINE_AGE_MS = 40 * MIN;

  http.get('*/api/v1/sensors/:id/data', ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const sensorId = String(params.id);
    const sensor = db.sensors.find((s) => s.sensor_id === sensorId);
    if (!sensor) return errorResponse(404, 'NOT_FOUND', 'Sensor no encontrado');

    const url = new URL(request.url);
    const now = Date.now();
    const hasta = url.searchParams.get('hasta');
    const desde = url.searchParams.get('desde');
    const to = hasta ? Date.parse(hasta) : now;
    const from = desde ? Date.parse(desde) : to - DAY;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Rango inválido', [
        { path: 'desde', message: 'desde debe ser una fecha anterior a hasta' },
      ]);
    }
    if (to - from > MAX_WINDOW_MS) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Rango demasiado amplio', [
        { path: 'hasta', message: 'El rango no puede superar 31 días' },
      ]);
    }
    const readings = generateReadings(sensor, {
      from,
      to: Math.min(to, now),
      offlineSince: db.offlineSensorIds.has(sensorId) ? now - OFFLINE_AGE_MS : null,
      spikes: db.alerts
        .filter((a) => a.sensor_id === sensorId && a.level !== 'INFO' && a.value_triggered !== null)
        .map((a) => ({ t: Date.parse(a.timestamp), value: a.value_triggered ?? 0 })),
    });
    return HttpResponse.json(readings);
  }),
```
(dentro del arreglo `sensorHandlers`; las constantes van al nivel del módulo).

En `apps/web/src/mocks/handlers/dashboard.ts`, añadir (imports `requireRole`, `errorResponse` si hace falta, `mostSevere`, `type AlertLevel` de `@gd/domain`):
```ts
function isStructural(sensorId: string): boolean {
  return db.sensors.some((s) => s.sensor_id === sensorId && s.category === 'structural');
}

/** Inicio del mes en curso en hora de Bogotá (UTC−5). */
function startOfMonthBogota(now: number): number {
  const local = new Date(now - 5 * 3_600_000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + 5 * 3_600_000;
}

  http.get('*/api/v1/dashboard/structural', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const now = new Date();
    const open = db.alerts.filter((a) => !a.acknowledged && isStructural(a.sensor_id));
    const count = (level: AlertAdmin['level']) => open.filter((a) => a.level === level).length;
    const offline = getSensors(now.getTime()).filter((s) => s.category === 'structural' && isOffline(s.last_seen_at, now)).length;
    const bySensor = new Map<string, AlertLevel[]>();
    for (const alert of open) bySensor.set(alert.sensor_id, [...(bySensor.get(alert.sensor_id) ?? []), alert.level]);
    return HttpResponse.json({
      structural_score: Math.max(0, 100 - (25 * count('CRITICAL') + 10 * count('WARNING') + 2 * count('INFO') + 5 * offline)),
      sensors_in_alert: [...bySensor.entries()].map(([sensor_id, levels]) => ({
        sensor_id,
        level: mostSevere(levels) ?? 'INFO',
        alerts: levels.length,
      })),
    });
  }),

  http.get('*/api/v1/dashboard/consumption', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    const now = Date.now();
    const byUnit =
      db.scenario === 'vacio'
        ? []
        : [
            { unit: 'm³', current_period: 1234.5, previous_period: 1100.2, variation_pct: 12.2 },
            db.scenario === 'caido'
              ? { unit: 'kWh', current_period: 8420, previous_period: null, variation_pct: null }
              : { unit: 'kWh', current_period: 8420, previous_period: 9010, variation_pct: -6.5 },
          ];
    return HttpResponse.json({
      period: { from: new Date(startOfMonthBogota(now)).toISOString(), to: new Date(now).toISOString() },
      by_unit: byUnit,
    });
  }),
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS; los puntajes del home (96/56/66/100) no cambian.

- [ ] **Step 5: Commit**

```
git add apps/web/src/mocks
git commit -m "feat(mocks): lecturas por minuto, dashboard estructural y de consumos"
```

---

### Task 6: Base de gráficas (ECharts modular, serie temporal, tabla y rangos)

**Files:**
- Create: `apps/web/src/ui/chart/echartsLoader.ts`, `EChart.tsx`, `palette.ts`, `timeSeriesOption.ts`, `timeSeriesOption.test.ts`, `barOptions.ts`, `barOptions.test.ts`, `SeriesTable.tsx`, `SeriesTable.test.tsx`, `RangeSelector.tsx`, `RangeSelector.test.tsx`, `EChart.test.tsx`, `Chart.module.css`
- Modify: `apps/web/src/ui/tokens.css` (tokens `--chart-1..3`), `apps/web/src/test/setup.ts` (mock del cargador), `apps/web/package.json` (dependencia `echarts`)

**Interfaces:**
- Consumes: `SeriesPoint`, `RangeKey`, `RANGE_KEYS`, `ZoneDensity`, `STATUS_ORDER`, `StatusLevel`, `formatAxisTick`, `formatDateTime`, `formatNumber` (`@gd/domain`); `STATUS_META`, `Button`.
- Produces:
  - `loadECharts(): Promise<typeof import('echarts/core')>` (registra solo `LineChart`, `BarChart`, `Grid`, `Tooltip`, `DataZoom`, `Legend`, `MarkLine` y `CanvasRenderer`; una sola carga)
  - `EChart({ option, label, height? })` — `div role="img" aria-label={label}`; inicializa en un efecto, `setOption(…, { notMerge: true })` al cambiar, redimensiona con `ResizeObserver`, `dispose()` al desmontar.
  - `cssVar(name, fallback)`; `seriesPalette(): string[]`; `statusPalette(): Record<StatusLevel, string>`
  - `interface ChartSeries { name: string; points: SeriesPoint[] }`; `interface ChartMarker { t: number; label: string }`; `buildTimeSeriesOption(input: { series: ChartSeries[]; unit: string | null; palette: string[]; spanMs: number; markers?: ChartMarker[] }): EChartsCoreOption`; `escapeHtml(text: string): string`
  - `buildDensityOption(zones: ZoneDensity[], palette: Record<StatusLevel, string>): EChartsCoreOption` (barras horizontales apiladas por estado, leyenda con texto); `buildComparisonOption(input: { unit: string; current: number; previous: number | null; palette: string[] }): EChartsCoreOption`
  - `SeriesTable({ caption, series, unit, maxRows? })` — tabla accesible (fecha + una columna por serie, más recientes primero, máx. 200 filas con nota)
  - `RANGE_LABEL: Record<RangeKey, string>` ("1 hora", "24 horas", "7 días", "30 días"); `RangeSelector({ value, onChange })` — `role="group" aria-label="Rango de tiempo"`, botones con `aria-pressed`.
- En tests (jsdom no dibuja canvas) el cargador queda simulado globalmente con una promesa que nunca resuelve: los tests verifican las opciones y las alternativas de texto, no el canvas.

- [ ] **Step 1: Instalar ECharts**

Run: `pnpm --filter @gd/web add echarts@^5.6`

- [ ] **Step 2: Escribir los tests que fallan**

`apps/web/src/ui/chart/timeSeriesOption.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildTimeSeriesOption, escapeHtml } from './timeSeriesOption';

const t0 = Date.parse('2026-10-02T10:00:00Z');
const base = {
  unit: 'g',
  palette: ['#111', '#222', '#333'],
  spanMs: 3_600_000,
  series: [{ name: 'Eje X', points: [[t0, 1], [t0 + 60_000, 2]] as [number, number][] }],
};

describe('buildTimeSeriesOption', () => {
  it('eje temporal, unidad en el eje Y y una serie de línea sin símbolos', () => {
    const option = buildTimeSeriesOption(base) as Record<string, any>;
    expect(option.xAxis.type).toBe('time');
    expect(option.yAxis.name).toBe('g');
    expect(option.series).toHaveLength(1);
    expect(option.series[0]).toMatchObject({ type: 'line', name: 'Eje X', showSymbol: false });
    expect(option.series[0].data).toEqual(base.series[0]?.points);
    expect(option.legend.show).toBe(false);
  });

  it('muestra la leyenda con varias series y las marcas de alerta en la primera', () => {
    const option = buildTimeSeriesOption({
      ...base,
      series: [...base.series, { name: 'Eje Y', points: [] }],
      markers: [{ t: t0, label: 'Crítico' }],
    }) as Record<string, any>;
    expect(option.legend.data).toEqual(['Eje X', 'Eje Y']);
    expect(option.series[0].markLine.data).toEqual([{ name: 'Crítico', xAxis: t0 }]);
    expect(option.series[1].markLine).toBeUndefined();
  });

  it('el tooltip formatea en hora de Bogotá y escapa el texto', () => {
    const option = buildTimeSeriesOption({ ...base, unit: '<b>g</b>' }) as Record<string, any>;
    const html: string = option.tooltip.formatter([{ seriesName: 'Eje <X>', value: [t0, 1.23456] }]);
    expect(html).toContain('Eje &lt;X&gt;');
    expect(html).toContain('&lt;b&gt;g&lt;/b&gt;');
    expect(html).toContain('1,235');
    expect(html).not.toContain('<b>');
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});
```
(En este archivo de test se permite `any` para inspeccionar la opción: añadir al inicio `/* eslint-disable @typescript-eslint/no-explicit-any -- inspección de la opción de ECharts en tests */`. Si el implementador prefiere, tipar con un helper `get(option, 'xAxis.type')` y evitar el comentario.)

`apps/web/src/ui/chart/barOptions.test.ts`:
```ts
/* eslint-disable @typescript-eslint/no-explicit-any -- inspección de la opción de ECharts en tests */
import { describe, expect, it } from 'vitest';
import { buildComparisonOption, buildDensityOption } from './barOptions';

const palette = { CRITICAL: '#c', WARNING: '#w', INFO: '#i', OK: '#o', OFFLINE: '#f' };

describe('buildDensityOption', () => {
  it('una serie apilada por estado con nombre de texto y las zonas como categorías', () => {
    const option = buildDensityOption(
      [{ zone: 'Lobby', total: 2, counts: { CRITICAL: 1, WARNING: 0, INFO: 0, OK: 1, OFFLINE: 0 } }],
      palette,
    ) as Record<string, any>;
    expect(option.yAxis.data).toEqual(['Lobby']);
    expect(option.series.map((s: any) => s.name)).toEqual(['Crítico', 'Advertencia', 'Sin datos', 'Informativo', 'Normal']);
    expect(option.series.every((s: any) => s.stack === 'total' && s.type === 'bar')).toBe(true);
    expect(option.series[0].data).toEqual([1]);
  });
});

describe('buildComparisonOption', () => {
  it('dos barras con el mes anterior y el actual', () => {
    const option = buildComparisonOption({ unit: 'm³', current: 1234.5, previous: 1100.2, palette: ['#1', '#2'] }) as Record<string, any>;
    expect(option.xAxis.data).toEqual(['Mes anterior (mismo tramo)', 'Mes en curso']);
    expect(option.series[0].data.map((d: any) => d.value)).toEqual([1100.2, 1234.5]);
  });
  it('sin periodo anterior solo hay una barra', () => {
    const option = buildComparisonOption({ unit: 'kWh', current: 8420, previous: null, palette: ['#1', '#2'] }) as Record<string, any>;
    expect(option.xAxis.data).toEqual(['Mes en curso']);
  });
});
```

`apps/web/src/ui/chart/SeriesTable.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeriesTable } from './SeriesTable';

const t0 = Date.parse('2026-10-02T20:00:00Z');

describe('SeriesTable', () => {
  it('fecha más reciente primero, una columna por serie con unidad', () => {
    render(
      <SeriesTable
        caption="Lecturas del sensor"
        unit="g"
        series={[
          { name: 'Eje X', points: [[t0, 1], [t0 + 60_000, 2]] },
          { name: 'Eje Y', points: [[t0 + 60_000, 3]] },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Lecturas del sensor' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Fecha y hora', 'Eje X (g)', 'Eje Y (g)']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getAllByRole('cell').map((c) => c.textContent?.replace(/\s/g, ' '))).toEqual([
      expect.stringMatching(/3:01 p\. ?m\./),
      '2',
      '3',
    ]);
    expect(within(rows[1]!).getAllByRole('cell')[2]).toHaveTextContent('—');
  });

  it('limita las filas y lo dice', () => {
    const points = Array.from({ length: 300 }, (_, i): [number, number] => [t0 + i * 60_000, i]);
    render(<SeriesTable caption="Lecturas" unit={null} series={[{ name: 'CO₂', points }]} maxRows={200} />);
    expect(screen.getAllByRole('row')).toHaveLength(201);
    expect(screen.getByText('Se muestran las 200 lecturas más recientes de 300.')).toBeInTheDocument();
  });
});
```

`apps/web/src/ui/chart/RangeSelector.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RangeSelector } from './RangeSelector';

describe('RangeSelector', () => {
  it('marca el rango activo y avisa el cambio', async () => {
    const onChange = vi.fn();
    render(<RangeSelector value="24h" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Rango de tiempo' });
    expect(within(group).getByRole('button', { name: '24 horas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(group).getByRole('button', { name: '7 días' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });
});
```

`apps/web/src/ui/chart/EChart.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EChart } from './EChart';

describe('EChart', () => {
  it('expone un nombre accesible aunque el lienzo no se haya dibujado', () => {
    render(<EChart option={{}} label="Serie de Acelerómetro, 24 horas" />);
    expect(screen.getByRole('img', { name: 'Serie de Acelerómetro, 24 horas' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — módulos de `ui/chart` no encontrados.

- [ ] **Step 4: Implementar**

Añadir a `apps/web/src/ui/tokens.css`, dentro de `:root` (claro):
```css
  --chart-1: #175cd3;
  --chart-2: #b42318;
  --chart-3: #067647;
```
y dentro de los dos bloques oscuros existentes (`@media (prefers-color-scheme: dark)` y el que aplique a `data-theme` si existe):
```css
  --chart-1: #84caff;
  --chart-2: #fda29b;
  --chart-3: #75e0a7;
```

`apps/web/src/ui/chart/echartsLoader.ts`:
```ts
export type EChartsModule = typeof import('echarts/core');

let loading: Promise<EChartsModule> | null = null;

/** Carga diferida y modular: solo los componentes que usa la app (el bundle inicial no incluye ECharts). */
export function loadECharts(): Promise<EChartsModule> {
  loading ??= Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]).then(([core, charts, components, renderers]) => {
    core.use([
      charts.LineChart,
      charts.BarChart,
      components.GridComponent,
      components.TooltipComponent,
      components.DataZoomComponent,
      components.LegendComponent,
      components.MarkLineComponent,
      renderers.CanvasRenderer,
    ]);
    return core;
  });
  return loading;
}
```

`apps/web/src/ui/chart/EChart.tsx`:
```tsx
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { useEffect, useRef } from 'react';
import styles from './Chart.module.css';
import { loadECharts } from './echartsLoader';

interface EChartProps {
  option: EChartsCoreOption;
  /** Descripción para lectores de pantalla; los datos están en la alternativa "Ver como tabla". */
  label: string;
  height?: number;
}

export function EChart({ option, label, height = 280 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void loadECharts().then((echarts) => {
      const container = containerRef.current;
      if (disposed || !container) return;
      const chart = echarts.init(container, undefined, { renderer: 'canvas' });
      chart.setOption(optionRef.current, { notMerge: true });
      chartRef.current = chart;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => chart.resize());
        observer.observe(container);
      }
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} className={styles.chart} role="img" aria-label={label} style={{ height }} />;
}
```

`apps/web/src/ui/chart/palette.ts`:
```ts
import type { StatusLevel } from '@gd/domain';

export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function seriesPalette(): string[] {
  return [cssVar('--chart-1', '#175cd3'), cssVar('--chart-2', '#b42318'), cssVar('--chart-3', '#067647')];
}

export function statusPalette(): Record<StatusLevel, string> {
  return {
    CRITICAL: cssVar('--status-critical-fg', '#b42318'),
    WARNING: cssVar('--status-warning-fg', '#93370d'),
    INFO: cssVar('--status-info-fg', '#175cd3'),
    OK: cssVar('--status-ok-fg', '#067647'),
    OFFLINE: cssVar('--status-offline-fg', '#344054'),
  };
}
```

`apps/web/src/ui/chart/timeSeriesOption.ts`:
```ts
import { formatAxisTick, formatDateTime, formatNumber, type SeriesPoint } from '@gd/domain';
import type { EChartsCoreOption } from 'echarts/core';

export interface ChartSeries {
  name: string;
  points: SeriesPoint[];
}

export interface ChartMarker {
  t: number;
  label: string;
}

export interface TimeSeriesOptionInput {
  series: ChartSeries[];
  unit: string | null;
  palette: string[];
  spanMs: number;
  markers?: ChartMarker[];
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** El tooltip de ECharts es HTML: todo texto se escapa. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function tooltipHtml(params: unknown, unit: string | null): string {
  const items = Array.isArray(params) ? params : [params];
  let time = '';
  const rows: string[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const { seriesName, value } = item as { seriesName?: unknown; value?: unknown };
    if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number') continue;
    time = formatDateTime(new Date(value[0]).toISOString());
    const suffix = unit ? ` ${escapeHtml(unit)}` : '';
    rows.push(`${escapeHtml(String(seriesName ?? ''))}: ${escapeHtml(formatNumber(value[1], 3))}${suffix}`);
  }
  return [escapeHtml(time), ...rows].join('<br/>');
}

export function buildTimeSeriesOption(input: TimeSeriesOptionInput): EChartsCoreOption {
  const multiple = input.series.length > 1;
  const markers = input.markers ?? [];
  return {
    animation: false,
    color: input.palette,
    grid: { left: 64, right: 16, top: multiple ? 36 : 16, bottom: 64 },
    legend: multiple ? { top: 0, data: input.series.map((s) => s.name) } : { show: false },
    tooltip: { trigger: 'axis', formatter: (params: unknown) => tooltipHtml(params, input.unit) },
    xAxis: {
      type: 'time',
      axisLabel: { hideOverlap: true, formatter: (value: number) => formatAxisTick(value, input.spanMs) },
    },
    yAxis: {
      type: 'value',
      name: input.unit ?? '',
      scale: true,
      axisLabel: { formatter: (value: number) => formatNumber(value, 3) },
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', height: 20, bottom: 8, labelFormatter: (value: number) => formatAxisTick(value, input.spanMs) },
    ],
    series: input.series.map((s, index) => ({
      name: s.name,
      type: 'line',
      showSymbol: false,
      lineStyle: { width: 1.5 },
      data: s.points,
      markLine:
        index === 0 && markers.length > 0
          ? {
              symbol: 'none',
              silent: true,
              label: { formatter: '{b}' },
              data: markers.map((m) => ({ name: m.label, xAxis: m.t })),
            }
          : undefined,
    })),
  };
}
```

`apps/web/src/ui/chart/barOptions.ts`:
```ts
import { STATUS_ORDER, formatNumber, type StatusLevel, type ZoneDensity } from '@gd/domain';
import type { EChartsCoreOption } from 'echarts/core';
import { STATUS_META } from '../statusMeta';

export function buildDensityOption(zones: ZoneDensity[], palette: Record<StatusLevel, string>): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: 140, right: 16, top: 36, bottom: 24 },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: zones.map((z) => z.zone), axisLabel: { width: 128, overflow: 'truncate' } },
    series: STATUS_ORDER.map((level) => ({
      name: STATUS_META[level].label,
      type: 'bar',
      stack: 'total',
      itemStyle: { color: palette[level] },
      data: zones.map((z) => z.counts[level]),
    })),
  };
}

export function buildComparisonOption(input: {
  unit: string;
  current: number;
  previous: number | null;
  palette: string[];
}): EChartsCoreOption {
  const bars = [
    ...(input.previous === null ? [] : [{ label: 'Mes anterior (mismo tramo)', value: input.previous, color: input.palette[1] }]),
    { label: 'Mes en curso', value: input.current, color: input.palette[0] },
  ];
  return {
    animation: false,
    grid: { left: 72, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: 'item', formatter: (p: { name?: string; value?: number }) => `${p.name ?? ''}: ${formatNumber(p.value ?? 0)} ${input.unit}` },
    xAxis: { type: 'category', data: bars.map((b) => b.label) },
    yAxis: { type: 'value', name: input.unit },
    series: [{ type: 'bar', barMaxWidth: 48, data: bars.map((b) => ({ value: b.value, itemStyle: { color: b.color } })) }],
  };
}
```
(el `formatter` del tooltip devuelve solo texto propio y números; `unit` viene del backend: escaparlo con `escapeHtml` de `timeSeriesOption.ts`).

`apps/web/src/ui/chart/SeriesTable.tsx`:
```tsx
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
  const byTime = new Map<number, Map<string, number>>();
  for (const s of series) {
    for (const [t, v] of s.points) {
      const row = byTime.get(t) ?? new Map<string, number>();
      row.set(s.name, v);
      byTime.set(t, row);
    }
  }
  const times = [...byTime.keys()].sort((a, b) => b - a);
  const shown = times.slice(0, maxRows);
  const suffix = unit ? ` (${unit})` : '';
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha y hora</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
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
              {series.map((s) => (
                <td key={s.name}>{formatNumber(byTime.get(t)?.get(s.name), 3)}</td>
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
```

`apps/web/src/ui/chart/RangeSelector.tsx`:
```tsx
import { RANGE_KEYS, type RangeKey } from '@gd/domain';
import styles from './Chart.module.css';

export const RANGE_LABEL: Record<RangeKey, string> = {
  '1h': '1 hora',
  '24h': '24 horas',
  '7d': '7 días',
  '30d': '30 días',
};

export function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (next: RangeKey) => void }) {
  return (
    <div className={styles.ranges} role="group" aria-label="Rango de tiempo">
      {RANGE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.range}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {RANGE_LABEL[key]}
        </button>
      ))}
    </div>
  );
}
```

`apps/web/src/ui/chart/Chart.module.css`:
```css
.chart { width: 100%; min-width: 0; }
.ranges { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.range {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.range[aria-pressed='true'] { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 600; }
.tableWrap { overflow-x: auto; max-height: 360px; overflow-y: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.table caption { text-align: left; font-weight: 600; padding-bottom: var(--space-2); }
.table th, .table td { padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
.table th:first-child, .table td:first-child { text-align: left; }
.note { color: var(--text-muted); font-size: 0.8125rem; margin: var(--space-2) 0 0; }
```

En `apps/web/src/test/setup.ts`, añadir al inicio (después de los imports existentes):
```ts
import { vi } from 'vitest';

// jsdom no dibuja canvas: en tests el cargador de ECharts nunca resuelve y se verifican opciones y alternativas de texto.
vi.mock('../ui/chart/echartsLoader', () => ({ loadECharts: () => new Promise(() => {}) }));
```
(si el archivo ya importa de `vitest`, añadir `vi` a ese import).

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint; pnpm --filter @gd/web build`
Expected: PASS; en la salida del build ECharts aparece en *chunks* separados del `index` (no en el bundle inicial). Si los tipos de `EChartsCoreOption` rechazan algún formateador, tipar el parámetro con lo que exija la definición instalada (sin `any` en código de producción).

- [ ] **Step 6: Commit**

```
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): base de gráficas con ECharts modular, tabla alternativa y selector de rango"
```

---

### Task 7: Reducción de series en un Web Worker

**Files:**
- Create: `apps/web/src/features/series/downsampleTask.ts`, `downsample.worker.ts`, `useDownsampledSeries.ts`, `useDownsampledSeries.test.tsx`

**Interfaces:**
- Consumes: `downsampleSeries`, `DownsampleStrategy`, `SeriesMap`, `TARGET_POINTS` (`@gd/domain`).
- Produces:
  - `interface DownsampleRequest { id: number; series: SeriesMap; strategy: DownsampleStrategy; target: number }`; `interface DownsampleResponse { id: number; series: SeriesMap }`; `handleDownsample(request): DownsampleResponse`
  - `downsample.worker.ts` (Worker de módulo que responde con `handleDownsample`)
  - `useDownsampledSeries(series: SeriesMap, strategy: DownsampleStrategy, target?: number): { series: SeriesMap; pending: boolean }` — sin reducción si ninguna serie supera `target`; con Worker disponible reduce fuera del hilo principal (ignora respuestas obsoletas); sin Worker o si el Worker falla, reduce de forma síncrona.
  - `__resetDownsampleWorkerForTests(): void`

- [ ] **Step 1: Escribir el test que falla**

`apps/web/src/features/series/useDownsampledSeries.test.tsx`:
```tsx
import type { SeriesMap } from '@gd/domain';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleDownsample, type DownsampleRequest } from './downsampleTask';
import { __resetDownsampleWorkerForTests, useDownsampledSeries } from './useDownsampledSeries';

function longSeries(n: number): SeriesMap {
  return { x: Array.from({ length: n }, (_, i): [number, number] => [i * 60_000, Math.sin(i / 30)]) };
}

const originalWorker = globalThis.Worker;

afterEach(() => {
  __resetDownsampleWorkerForTests();
  if (originalWorker) globalThis.Worker = originalWorker;
  else Reflect.deleteProperty(globalThis, 'Worker');
});

describe('useDownsampledSeries', () => {
  it('series cortas pasan tal cual', () => {
    const series = longSeries(100);
    const { result } = renderHook(() => useDownsampledSeries(series, 'lttb'));
    expect(result.current).toEqual({ series, pending: false });
  });

  it('sin Worker reduce en el hilo principal', () => {
    Reflect.deleteProperty(globalThis, 'Worker');
    const { result } = renderHook(() => useDownsampledSeries(longSeries(10_000), 'lttb'));
    expect(result.current.pending).toBe(false);
    expect(result.current.series.x).toHaveLength(1500);
  });

  it('con Worker reduce fuera del hilo principal e ignora respuestas obsoletas', async () => {
    const posted: DownsampleRequest[] = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(request: DownsampleRequest) {
        posted.push(request);
        queueMicrotask(() => this.onmessage?.({ data: handleDownsample(request) } as MessageEvent));
      }
      terminate() {}
    }
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    const first = longSeries(10_000);
    const second = longSeries(20_000);
    const { result, rerender } = renderHook(({ s }: { s: SeriesMap }) => useDownsampledSeries(s, 'minmax'), {
      initialProps: { s: first },
    });
    expect(result.current.pending).toBe(true);
    rerender({ s: second });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(posted).toHaveLength(2);
    expect(result.current.series.x!.length).toBeLessThanOrEqual(1500);
    expect(result.current.series.x!.at(-1)![0]).toBe(19_999 * 60_000);
  });

  it('si el Worker falla vuelve a la reducción síncrona', async () => {
    class BrokenWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onerror?.());
      }
      terminate() {}
    }
    globalThis.Worker = BrokenWorker as unknown as typeof Worker;
    const { result } = renderHook(() => useDownsampledSeries(longSeries(10_000), 'lttb'));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.series.x).toHaveLength(1500);
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 3: Implementar**

`apps/web/src/features/series/downsampleTask.ts`:
```ts
import { downsampleSeries, type DownsampleStrategy, type SeriesMap } from '@gd/domain';

export interface DownsampleRequest {
  id: number;
  series: SeriesMap;
  strategy: DownsampleStrategy;
  target: number;
}

export interface DownsampleResponse {
  id: number;
  series: SeriesMap;
}

export function handleDownsample(request: DownsampleRequest): DownsampleResponse {
  return { id: request.id, series: downsampleSeries(request.series, request.strategy, request.target) };
}
```

`apps/web/src/features/series/downsample.worker.ts`:
```ts
import { handleDownsample, type DownsampleRequest } from './downsampleTask';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DownsampleRequest>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = (event) => {
  scope.postMessage(handleDownsample(event.data));
};
```

`apps/web/src/features/series/useDownsampledSeries.ts`:
```ts
import { TARGET_POINTS, downsampleSeries, type DownsampleStrategy, type SeriesMap } from '@gd/domain';
import { useEffect, useMemo, useState } from 'react';
import { handleDownsample, type DownsampleRequest, type DownsampleResponse } from './downsampleTask';

type Pending = { request: DownsampleRequest; resolve: (series: SeriesMap) => void };

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function workerAvailable(): boolean {
  return typeof Worker !== 'undefined' && !workerBroken;
}

function getWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL('./downsample.worker.ts', import.meta.url), { type: 'module' });
  created.onmessage = (event: MessageEvent<DownsampleResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    entry.resolve(event.data.series);
  };
  created.onerror = () => {
    // Si el Worker falla, cada petición pendiente se resuelve en el hilo principal.
    workerBroken = true;
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.resolve(handleDownsample(entry.request).series);
    }
  };
  worker = created;
  return created;
}

export function __resetDownsampleWorkerForTests(): void {
  worker?.terminate();
  worker = null;
  workerBroken = false;
  pending.clear();
}

export function useDownsampledSeries(
  series: SeriesMap,
  strategy: DownsampleStrategy,
  target: number = TARGET_POINTS,
): { series: SeriesMap; pending: boolean } {
  const needs = Object.values(series).some((points) => points.length > target);
  const useWorker = needs && workerAvailable();
  const syncResult = useMemo(
    () => (needs && !useWorker ? downsampleSeries(series, strategy, target) : null),
    [needs, useWorker, series, strategy, target],
  );
  const [result, setResult] = useState<{ input: SeriesMap; output: SeriesMap } | null>(null);

  useEffect(() => {
    if (!useWorker) return;
    let cancelled = false;
    const request: DownsampleRequest = { id: nextId++, series, strategy, target };
    pending.set(request.id, {
      request,
      resolve: (output) => {
        if (!cancelled) setResult({ input: series, output });
      },
    });
    getWorker().postMessage(request);
    return () => {
      cancelled = true;
      pending.delete(request.id);
    };
  }, [useWorker, series, strategy, target]);

  if (!needs) return { series, pending: false };
  if (syncResult) return { series: syncResult, pending: false };
  if (result && result.input === series) return { series: result.output, pending: false };
  return { series: result?.output ?? {}, pending: true };
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint; pnpm --filter @gd/web build`
Expected: PASS; el build emite el Worker como archivo separado (`downsample.worker-*.js`).

- [ ] **Step 5: Commit**

```
git add apps/web/src/features/series
git commit -m "feat(web): reducción de series en un Web Worker con respaldo síncrono"
```

---

### Task 8: Panel de detalle de sensor con series

**Files:**
- Create: `apps/web/src/features/series/seriesCopy.ts`, `SensorSeriesPanel.tsx`, `Series.module.css`
- Create: `apps/web/src/features/sensors/sensorView.ts`, `sensorView.test.ts`, `useSensorSelection.ts`, `SensorDetailPanel.tsx`, `SensorDetailPanel.test.tsx`, `Sensors.module.css`
- Modify: `apps/web/src/test/renderApp.tsx` (helper `renderInApp`)

**Interfaces:**
- Consumes: `useSensorReadings`, `useSensors`, `useAlerts` (`@gd/query`); `readingsToSeries`, `rangeWindow`, `RANGE_MS`, `strategyForSensorType`, `measuredChange`, `shorterRange`, `buildSensorStatusMap`, `isRangeKey`, `DEFAULT_RANGE`, `formatNumber`, `formatDateTime`, `formatRelative` (`@gd/domain`); `useDownsampledSeries` (Task 7); `EChart`, `buildTimeSeriesOption`, `seriesPalette`, `SeriesTable`, `RangeSelector`, `RANGE_LABEL` (Task 6); `StatusBadge`, `STATUS_META`, `Button`, `useNow`, `errorMessage`, `categoryLabel`.
- Produces:
  - `seriesLabel(key: string): string` (`x`→"Eje X", `y`→"Eje Y", `z`→"Eje Z", `width`→"Apertura", `flow`→"Caudal", `power`→"Potencia", `co2`→"CO₂", otro → la clave)
  - `SensorSeriesPanel({ sensor, range, onRangeChange, markers? })` — estados: cargando (`role="status"` "Cargando lecturas"), error con "Reintentar", demasiadas lecturas ("El rango tiene demasiadas lecturas para mostrarlas aquí." + botón "Ver {rango menor}"), sin lecturas ("Sin lecturas en este rango."), gráfica (`EChart` con nombre "Serie de {nombre del sensor}, {rango}") + botón "Ver como tabla"/"Ocultar tabla" (`aria-expanded`) + tabla; fisurómetros: "Cambio medido en el periodo: +0,3 mm".
  - `interface SensorView { sensorId?: string; range: RangeKey }`; `readSensorView(params: URLSearchParams): SensorView` (id `/^[A-Za-z0-9_-]{1,64}$/`, rango inválido → `24h`); `withSensorView(params: URLSearchParams, patch: { sensorId?: string | null; range?: RangeKey }): URLSearchParams` (conserva el resto de parámetros; `rango` se omite si es el predeterminado)
  - `useSensorSelection(): { view: SensorView; select(id: string): void; close(): void; setRange(range: RangeKey): void }` (URL `?sensor=&rango=`; `select` añade entrada al historial, `close`/`setRange` la reemplazan)
  - `SensorDetailPanel({ sensorId, range, onRangeChange, onClose })` — `<aside>` con título "Detalle del sensor" (recibe el foco), botón "Cerrar detalle del sensor", Escape cierra; datos: nombre, estado (`StatusBadge` con "Sin datos desde …"), zona, categoría, batería, firmware, última lectura, últimos valores; `SensorSeriesPanel` con marcas de alertas CRITICAL/WARNING; "Alertas de este sensor" (enlaces a `/alertas?alerta=`); enlace "Ver en 3D" (`/gemelo?sensor=`). Sensor inexistente → "No encontramos este sensor."
  - `renderInApp(services: Services, ui: ReactNode, route?: string)` en `test/renderApp.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/features/sensors/sensorView.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readSensorView, withSensorView } from './sensorView';

describe('sensorView', () => {
  it('lee sensor y rango válidos', () => {
    expect(readSensorView(new URLSearchParams('sensor=acc-t1-sotano&rango=7d'))).toEqual({ sensorId: 'acc-t1-sotano', range: '7d' });
  });
  it('ignora valores inválidos o maliciosos', () => {
    expect(readSensorView(new URLSearchParams('sensor=%3Cscript%3E&rango=2y'))).toEqual({ range: '24h' });
    expect(readSensorView(new URLSearchParams(`sensor=${'a'.repeat(65)}`))).toEqual({ range: '24h' });
  });
  it('conserva los demás parámetros y omite el rango por defecto', () => {
    const next = withSensorView(new URLSearchParams('estado=OFFLINE'), { sensorId: 'water-main', range: '24h' });
    expect(next.toString()).toBe('estado=OFFLINE&sensor=water-main');
    expect(withSensorView(next, { sensorId: null }).toString()).toBe('estado=OFFLINE');
    expect(withSensorView(next, { range: '30d' }).get('rango')).toBe('30d');
  });
});
```

`apps/web/src/features/sensors/SensorDetailPanel.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RangeKey } from '@gd/domain';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderInApp } from '../../test/renderApp';
import { SensorDetailPanel } from './SensorDetailPanel';

function Harness({ sensorId, onClose = () => {} }: { sensorId: string; onClose?: () => void }) {
  const [range, setRange] = useState<RangeKey>('24h');
  return <SensorDetailPanel sensorId={sensorId} range={range} onRangeChange={setRange} onClose={onClose} />;
}

async function open(sensorId: string, onClose?: () => void) {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderInApp(services, <Harness sensorId={sensorId} onClose={onClose} />);
  return within(await screen.findByRole('complementary', { name: 'Detalle del sensor' }));
}

describe('SensorDetailPanel', () => {
  it('muestra datos, estado, alertas y la serie con alternativa en tabla', async () => {
    resetDb('critico');
    const panel = await open('acc-t1-sotano');
    expect(await panel.findByRole('heading', { name: 'Acelerómetro Sótano Torre 1' })).toBeInTheDocument();
    expect(panel.getAllByText('Crítico').length).toBeGreaterThan(0);
    expect(panel.getByRole('link', { name: /Aceleración superior al umbral configurado/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/alertas\?alerta=alrt-\d{8}-00004$/),
    );
    expect(panel.getByRole('link', { name: 'Ver en 3D' })).toHaveAttribute('href', '/gemelo?sensor=acc-t1-sotano');
    expect(await panel.findByRole('img', { name: 'Serie de Acelerómetro Sótano Torre 1, 24 horas' })).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'Ver como tabla' }));
    const table = panel.getByRole('table', { name: 'Lecturas de Acelerómetro Sótano Torre 1' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha y hora',
      'Eje X (g)',
      'Eje Y (g)',
      'Eje Z (g)',
    ]);
  });

  it('cambiar el rango actualiza la serie', async () => {
    const panel = await open('water-main');
    await panel.findByRole('img', { name: /24 horas/ });
    await userEvent.click(panel.getByRole('button', { name: '1 hora' }));
    expect(await panel.findByRole('img', { name: 'Serie de Medidor acueducto principal, 1 hora' })).toBeInTheDocument();
  });

  it('un sensor sin datos lo dice y no se ve como normal', async () => {
    resetDb('caido');
    const panel = await open('acc-t2-sotano');
    expect(await panel.findByText(/^Sin datos desde/)).toBeInTheDocument();
    expect(panel.queryByText('Normal')).not.toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: '1 hora' }));
    expect(await panel.findByText('Sin lecturas en este rango.')).toBeInTheDocument();
  });

  it('el fisurómetro muestra el cambio medido en el periodo', async () => {
    const panel = await open('crack-t1-sotano');
    expect(await panel.findByText(/^Cambio medido en el periodo: [+−]\d/)).toBeInTheDocument();
  });

  it('un sensor inexistente lo dice', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderInApp(services, <Harness sensorId="no-existe" />);
    expect(await screen.findByText('No encontramos este sensor.')).toBeInTheDocument();
  });

  it('Escape cierra', async () => {
    const onClose = vi.fn();
    await open('water-main', onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — módulos no encontrados; `renderInApp` no existe.

- [ ] **Step 3: Implementar el helper de pruebas, la vista y la selección**

Añadir a `apps/web/src/test/renderApp.tsx`:
```tsx
import type { ReactNode } from 'react';

/** Renderiza un componente suelto con todos los providers de la app (para paneles y piezas). */
export function renderInApp(services: Services, ui: ReactNode, route = '/') {
  return render(
    <AppProviders services={services} sound={silentSound}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}
```

`apps/web/src/features/sensors/sensorView.ts`:
```ts
import { DEFAULT_RANGE, isRangeKey, type RangeKey } from '@gd/domain';

const SENSOR_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface SensorView {
  sensorId?: string;
  range: RangeKey;
}

export function readSensorView(params: URLSearchParams): SensorView {
  const view: SensorView = { range: DEFAULT_RANGE };
  const sensorId = params.get('sensor');
  if (sensorId !== null && SENSOR_ID.test(sensorId)) view.sensorId = sensorId;
  const range = params.get('rango');
  if (isRangeKey(range)) view.range = range;
  return view;
}

export function withSensorView(
  params: URLSearchParams,
  patch: { sensorId?: string | null; range?: RangeKey },
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (patch.sensorId === null) next.delete('sensor');
  else if (patch.sensorId !== undefined) next.set('sensor', patch.sensorId);
  if (patch.range !== undefined) {
    if (patch.range === DEFAULT_RANGE) next.delete('rango');
    else next.set('rango', patch.range);
  }
  if (!next.has('sensor')) next.delete('rango');
  return next;
}
```

`apps/web/src/features/sensors/useSensorSelection.ts`:
```ts
import type { RangeKey } from '@gd/domain';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { readSensorView, withSensorView, type SensorView } from './sensorView';

export function useSensorSelection(): {
  view: SensorView;
  select(sensorId: string): void;
  close(): void;
  setRange(range: RangeKey): void;
} {
  const [params, setParams] = useSearchParams();
  const view = readSensorView(params);
  const select = useCallback(
    (sensorId: string) => setParams((prev) => withSensorView(prev, { sensorId })),
    [setParams],
  );
  const close = useCallback(
    () => setParams((prev) => withSensorView(prev, { sensorId: null }), { replace: true }),
    [setParams],
  );
  const setRange = useCallback(
    (range: RangeKey) => setParams((prev) => withSensorView(prev, { range }), { replace: true }),
    [setParams],
  );
  return { view, select, close, setRange };
}
```

- [ ] **Step 4: Implementar el panel de series**

`apps/web/src/features/series/seriesCopy.ts`:
```ts
const SERIES_LABEL: Record<string, string> = {
  x: 'Eje X',
  y: 'Eje Y',
  z: 'Eje Z',
  width: 'Apertura',
  flow: 'Caudal',
  power: 'Potencia',
  co2: 'CO₂',
};

export function seriesLabel(key: string): string {
  return SERIES_LABEL[key] ?? key;
}
```

`apps/web/src/features/series/Series.module.css`:
```css
.panel { display: grid; gap: var(--space-3); min-width: 0; }
.header { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; }
.header h3 { margin: 0; font-size: 1rem; }
.skeleton { min-height: 280px; border-radius: var(--radius); background: var(--status-offline-bg); }
.message { margin: 0; color: var(--text-muted); }
.error { padding: var(--space-3); border-radius: var(--radius); background: var(--status-critical-bg); color: var(--status-critical-fg); }
.change { margin: 0; font-weight: 600; }
```

`apps/web/src/features/series/SensorSeriesPanel.tsx`:
```tsx
import type { Sensor } from '@gd/api';
import {
  RANGE_MS,
  formatNumber,
  measuredChange,
  rangeWindow,
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
import { seriesPalette } from '../../ui/chart/palette';
import { buildTimeSeriesOption, type ChartMarker } from '../../ui/chart/timeSeriesOption';
import { seriesLabel } from './seriesCopy';
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
  const raw = useMemo(() => readingsToSeries(data.readings, rangeWindow(range, Date.now())), [data.readings, range]);
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
  } else if (data.isError) {
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
        <EChart option={option} label={`Serie de ${sensor.name}, ${RANGE_LABEL[range]}`} />
        {change !== null && (
          <p className={styles.change}>
            Cambio medido en el periodo: {change >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(change), 2)} {sensor.unit ?? ''}
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
```

- [ ] **Step 5: Implementar el panel de detalle**

`apps/web/src/features/sensors/Sensors.module.css`:
```css
.page { display: grid; gap: var(--space-4); }
.page h1 { margin: 0; }
.intro { margin: var(--space-1) 0 0; color: var(--text-muted); }
.layout { display: grid; gap: var(--space-4); min-width: 0; }
@media (min-width: 1024px) {
  .layout[data-detail='open'] { grid-template-columns: minmax(0, 1fr) minmax(360px, 520px); align-items: start; }
}
.detail {
  position: sticky;
  top: var(--space-4);
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.detailHeader { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.detailHeader h2 { margin: 0; font-size: 1.125rem; }
.close { min-width: 44px; min-height: 44px; display: grid; place-items: center; border: none; background: transparent; color: var(--text-muted); cursor: pointer; }
.name { margin: 0; font-size: 1.125rem; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-4); margin: 0; }
.facts dt { color: var(--text-muted); }
.facts dd { margin: 0; overflow-wrap: anywhere; }
.alerts { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
.alerts a { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; min-height: 44px; color: var(--text); }
.actions a { min-height: 44px; display: inline-flex; align-items: center; color: var(--accent); font-weight: 600; }
.filters { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: end; }
.filters label { display: grid; gap: var(--space-1); font-size: 0.875rem; font-weight: 600; }
.filters select { min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font: inherit; }
.tableWrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; }
.table caption { text-align: left; font-weight: 600; padding-bottom: var(--space-2); }
.table th, .table td { padding: var(--space-2); border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
.table a { display: inline-flex; align-items: center; min-height: 44px; color: var(--accent); font-weight: 600; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-6); min-width: 0; }
.card h2 { margin: 0 0 var(--space-4); font-size: 1.125rem; }
@media (max-width: 1023px) {
  .detail { position: fixed; inset: auto 0 0 0; z-index: 120; max-height: 85vh; overflow-y: auto; border-radius: var(--radius) var(--radius) 0 0; box-shadow: 0 -8px 24px rgb(0 0 0 / 0.2); }
}
```

`apps/web/src/features/sensors/SensorDetailPanel.tsx`:
```tsx
import { buildSensorStatusMap, formatDateTime, formatNumber, formatRelative, type RangeKey } from '@gd/domain';
import { useAlerts, useSensors } from '@gd/query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
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
        .filter((a) => a.level !== 'INFO')
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
              <div key={key} style={{ display: 'contents' }}>
                <dt>{seriesLabel(key)}</dt>
                <dd>
                  {formatNumber(value, 3)} {sensor.unit ?? ''}
                </dd>
              </div>
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
```
(El `<div style={{display:'contents'}}>` dentro de `<dl>` es válido en HTML para agrupar `dt/dd`; si el linter o axe lo objeta, reemplazar por un `Fragment` con `key`.)

- [ ] **Step 6: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS, salida limpia.

- [ ] **Step 7: Commit**

```
git add apps/web/src
git commit -m "feat(web): panel de detalle de sensor con series, rangos y tabla alternativa"
```

---

### Task 9: Página de Sensores y densidad por zona

**Files:**
- Create: `apps/web/src/features/sensors/sensorFilters.ts`, `sensorFilters.test.ts`, `ZoneDensityCard.tsx`, `SensorsPage.tsx`, `SensorsPage.test.tsx`
- Create: `apps/web/src/features/home/HomeDensity.tsx`
- Modify: `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/routes.tsx`

**Interfaces:**
- Consumes: Task 3 (`densityByZone`, `STATUS_ORDER`), Task 6 (`EChart`, `buildDensityOption`, `statusPalette`), Task 8 (`SensorDetailPanel`, `useSensorSelection`, `withSensorView`), `useSensors`, `useAlerts`, `buildSensorStatusMap`, `compareAlertLevel`.
- Produces:
  - `interface SensorFilters { status?: StatusLevel; category?: 'structural' | 'consumption' | 'comfort'; zone?: string }`; `readSensorFilters(params): SensorFilters` (`estado`, `categoria`, `zona`; zona: 1–80 caracteres imprimibles); `writeSensorFilters(params: URLSearchParams, filters: SensorFilters): URLSearchParams` (conserva `sensor`/`rango`)
  - `ZoneDensityCard({ statuses })` — `section` "Sensores por zona" con gráfica de barras apiladas (`EChart`, nombre "Sensores por zona y estado") + "Ver como tabla" (tabla zona × estados)
  - `SensorsPage()` en `/sensores`: título "Sensores", filtros (Estado/Categoría/Zona), tabla "Sensores (N)" ordenada por gravedad (Crítico, Advertencia, Sin datos, Informativo, Normal) y nombre, cada nombre es un enlace que abre el detalle (`?sensor=`), `ZoneDensityCard`, `SensorDetailPanel`.
  - `HomeDensity()` — en el home del ADMIN, `ZoneDensityCard` con los datos de `useSensors` + alertas.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/features/sensors/sensorFilters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readSensorFilters, writeSensorFilters } from './sensorFilters';

describe('sensorFilters', () => {
  it('lee estado, categoría y zona', () => {
    expect(readSensorFilters(new URLSearchParams('estado=OFFLINE&categoria=structural&zona=S%C3%B3tano%20Torre%201'))).toEqual({
      status: 'OFFLINE',
      category: 'structural',
      zone: 'Sótano Torre 1',
    });
  });
  it('ignora valores inválidos', () => {
    expect(readSensorFilters(new URLSearchParams(`estado=ROTO&categoria=apto&zona=${'x'.repeat(81)}`))).toEqual({});
    expect(readSensorFilters(new URLSearchParams('zona=%0Amala'))).toEqual({});
  });
  it('escribe conservando sensor y rango', () => {
    const next = writeSensorFilters(new URLSearchParams('sensor=water-main&rango=7d&estado=OK'), { category: 'consumption' });
    expect(next.toString()).toBe('sensor=water-main&rango=7d&categoria=consumption');
  });
});
```

`apps/web/src/features/sensors/SensorsPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openSensors(route = '/sensores') {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, route);
  return screen.findByRole('table', { name: /^Sensores \(\d+\)$/ });
}

describe('página de sensores', () => {
  it('lista los 22 sensores con su estado', async () => {
    const table = await openSensors();
    expect(table).toHaveAccessibleName('Sensores (22)');
    expect(within(table).getAllByRole('row')).toHaveLength(23);
  });

  it('ordena por gravedad: lo crítico y lo que no reporta arriba', async () => {
    resetDb('critico');
    const table = await openSensors();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Crítico');
    expect(rows[2]).toHaveTextContent(/Sin datos desde/);
  });

  it('filtra por estado desde la URL', async () => {
    resetDb('caido');
    const table = await openSensors('/sensores?estado=OFFLINE');
    expect(table).toHaveAccessibleName('Sensores (6)');
  });

  it('abrir un sensor muestra su detalle', async () => {
    const table = await openSensors();
    await userEvent.click(within(table).getByRole('link', { name: 'Medidor acueducto principal' }));
    const panel = await screen.findByRole('complementary', { name: 'Detalle del sensor' });
    expect(within(panel).getByRole('heading', { name: 'Medidor acueducto principal' })).toBeInTheDocument();
  });

  it('la densidad por zona tiene alternativa en tabla', async () => {
    await openSensors();
    const density = screen.getByRole('region', { name: 'Sensores por zona' });
    expect(within(density).getByRole('img', { name: 'Sensores por zona y estado' })).toBeInTheDocument();
    await userEvent.click(within(density).getByRole('button', { name: 'Ver como tabla' }));
    const table = within(density).getByRole('table', { name: 'Sensores por zona y estado' });
    expect(within(table).getByRole('rowheader', { name: 'Gimnasio' })).toBeInTheDocument();
  });

  it('el home del administrador muestra la densidad por zona', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    expect(await screen.findByRole('region', { name: 'Sensores por zona' })).toBeInTheDocument();
  });

  it('el residente no ve la densidad en el home', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/');
    await screen.findByRole('region', { name: 'Salud del edificio' });
    expect(screen.queryByRole('region', { name: 'Sensores por zona' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — `/sensores` aún muestra el marcador; módulos no encontrados.

- [ ] **Step 3: Implementar**

`apps/web/src/features/sensors/sensorFilters.ts`:
```ts
import type { StatusLevel } from '@gd/domain';

const STATUSES: readonly StatusLevel[] = ['CRITICAL', 'WARNING', 'INFO', 'OK', 'OFFLINE'];
const CATEGORIES = ['structural', 'consumption', 'comfort'] as const;
type Category = (typeof CATEGORIES)[number];
/** Texto imprimible de 1 a 80 caracteres (sin controles). */
const ZONE = /^[^\u0000-\u001f\u007f]{1,80}$/;

export interface SensorFilters {
  status?: StatusLevel;
  category?: Category;
  zone?: string;
}

export function readSensorFilters(params: URLSearchParams): SensorFilters {
  const filters: SensorFilters = {};
  const status = params.get('estado');
  if (status !== null && (STATUSES as readonly string[]).includes(status)) filters.status = status as StatusLevel;
  const category = params.get('categoria');
  if (category !== null && (CATEGORIES as readonly string[]).includes(category)) filters.category = category as Category;
  const zone = params.get('zona');
  if (zone !== null && ZONE.test(zone)) filters.zone = zone;
  return filters;
}

export function writeSensorFilters(params: URLSearchParams, filters: SensorFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ['estado', 'categoria', 'zona']) next.delete(key);
  if (filters.status) next.set('estado', filters.status);
  if (filters.category) next.set('categoria', filters.category);
  if (filters.zone) next.set('zona', filters.zone);
  return next;
}
```
(si `no-control-regex` de ESLint objeta la clase `\u0000-\u001f`, reemplazar la regex por un recorrido de códigos de carácter como en `safeRedirect.ts` del Plan 1).

`apps/web/src/features/sensors/ZoneDensityCard.tsx`:
```tsx
import { STATUS_ORDER, densityByZone, type SensorStatus } from '@gd/domain';
import { useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { EChart } from '../../ui/chart/EChart';
import { buildDensityOption } from '../../ui/chart/barOptions';
import { statusPalette } from '../../ui/chart/palette';
import { STATUS_META } from '../../ui/statusMeta';
import styles from './Sensors.module.css';

export function ZoneDensityCard({ statuses }: { statuses: SensorStatus[] }) {
  const zones = useMemo(() => densityByZone(statuses), [statuses]);
  const option = useMemo(() => buildDensityOption(zones, statusPalette()), [zones]);
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={styles.card} aria-labelledby="zone-density-title">
      <h2 id="zone-density-title">Sensores por zona</h2>
      {zones.length === 0 ? (
        <p>No hay sensores registrados.</p>
      ) : (
        <>
          <EChart option={option} label="Sensores por zona y estado" height={Math.max(200, zones.length * 36 + 64)} />
          <Button variant="secondary" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Ocultar tabla' : 'Ver como tabla'}
          </Button>
          {showTable && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>Sensores por zona y estado</caption>
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
        </>
      )}
    </section>
  );
}
```

`apps/web/src/features/sensors/SensorsPage.tsx`:
```tsx
import type { Sensor } from '@gd/api';
import { STATUS_ORDER, buildSensorStatusMap, formatNumber, formatRelative, type SensorStatus } from '@gd/domain';
import { POLL_INTERVALS_MS, useAlerts, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataState } from '../../ui/DataState';
import { StatusBadge } from '../../ui/StatusBadge';
import { STATUS_META } from '../../ui/statusMeta';
import { useNow } from '../../ui/useNow';
import { CATEGORY_OPTIONS, categoryLabel } from '../alerts/alertCopy';
import { SensorDetailPanel } from './SensorDetailPanel';
import { readSensorFilters, writeSensorFilters, type SensorFilters } from './sensorFilters';
import { withSensorView } from './sensorView';
import styles from './Sensors.module.css';
import { useSensorSelection } from './useSensorSelection';
import { ZoneDensityCard } from './ZoneDensityCard';

interface Row {
  sensor: Sensor;
  status: SensorStatus;
}

function severityRank(status: SensorStatus): number {
  return STATUS_ORDER.indexOf(status.level);
}

export function SensorsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readSensorFilters(params);
  const selection = useSensorSelection();
  const sensors = useSensors();
  const alerts = useAlerts('ADMIN', {});
  const now = useNow();

  const rows = useMemo<Row[]>(() => {
    const list = sensors.data?.data ?? [];
    const statuses = buildSensorStatusMap(list, alerts.data?.data ?? [], now);
    return list
      .flatMap((sensor) => {
        const status = statuses.get(sensor.sensor_id);
        return status ? [{ sensor, status }] : [];
      })
      .sort((a, b) => severityRank(a.status) - severityRank(b.status) || a.sensor.name.localeCompare(b.sensor.name, 'es'));
  }, [sensors.data, alerts.data, now]);

  const zones = useMemo(() => [...new Set(rows.map((r) => r.sensor.zone))].sort((a, b) => a.localeCompare(b, 'es')), [rows]);
  const visible = rows.filter(
    (r) =>
      (!filters.status || r.status.level === filters.status) &&
      (!filters.category || r.sensor.category === filters.category) &&
      (!filters.zone || r.sensor.zone === filters.zone),
  );

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
            onChange={(e) => update({ status: (e.target.value || undefined) as SensorFilters['status'] })}
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
            onChange={(e) => update({ category: (e.target.value || undefined) as SensorFilters['category'] })}
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
        <div style={{ display: 'grid', gap: 'var(--space-4)', minWidth: 0 }}>
          <DataState label="sensores" query={sensors} staleAfterMs={POLL_INTERVALS_MS.sensors * 2}>
            {() => (
              <div className={styles.tableWrap}>
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
                          <StatusBadge level={status.level} lastSeenAt={sensor.last_seen_at} now={now} />
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
          {sensors.data && <ZoneDensityCard statuses={rows.map((r) => r.status)} />}
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
```

`apps/web/src/features/home/HomeDensity.tsx`:
```tsx
import { buildSensorStatusMap } from '@gd/domain';
import { useAlerts, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { useNow } from '../../ui/useNow';
import { ZoneDensityCard } from '../sensors/ZoneDensityCard';

/** Solo para ADMIN (los sensores no están disponibles para el residente). */
export function HomeDensity() {
  const sensors = useSensors();
  const alerts = useAlerts('ADMIN', {});
  const now = useNow();
  const statuses = useMemo(
    () => [...buildSensorStatusMap(sensors.data?.data ?? [], alerts.data?.data ?? [], now).values()],
    [sensors.data, alerts.data, now],
  );
  if (!sensors.data) return null;
  return <ZoneDensityCard statuses={statuses} />;
}
```

En `apps/web/src/features/home/HomePage.tsx`: importar `HomeDensity` y renderizar `{isAdmin && <HomeDensity />}` justo antes de `<CategoryLinks role={role} />`.

En `apps/web/src/app/routes.tsx`: importar `SensorsPage` y cambiar la ruta `sensores` a `<Route path="sensores" element={<SensorsPage />} />`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (los tests del home y rutas de los Planes 1–2 siguen en verde).

- [ ] **Step 5: Commit**

```
git add apps/web/src
git commit -m "feat(web): página de sensores con filtros, detalle y densidad por zona"
```

---

### Task 10: Estructural, Consumos y Calidad del aire

**Files:**
- Create: `apps/web/src/features/structural/StructuralPage.tsx`, `StructuralPage.test.tsx`
- Create: `apps/web/src/features/consumption/ConsumptionPage.tsx`, `ConsumptionPage.test.tsx`
- Create: `apps/web/src/features/comfort/ComfortPage.tsx`, `comfortCopy.ts`, `ComfortPage.test.tsx`
- Create: `apps/web/src/features/dashboards/Dashboards.module.css`
- Modify: `apps/web/src/app/routes.tsx`, `apps/web/src/features/realtime/RealtimeProvider.tsx`, `apps/web/src/features/realtime/RealtimeProvider.test.tsx` (solo añadir un test)

**Interfaces:**
- Consumes: `useDashboardStructural`, `useDashboardConsumption`, `useComfort`, `useSensors`, `useAlerts` (`@gd/query`); `clampScore`, `healthBand`, `describeVariation`, `COMFORT_TONE`, `buildSensorStatusMap`, `formatNumber`, `formatDate` (`@gd/domain`); `BAND_LABEL`, `BAND_TONE` (`features/home/healthCopy.ts`); `SensorDetailPanel`, `useSensorSelection`, `withSensorView` (Task 8); `EChart`, `buildComparisonOption`, `seriesPalette`; `DataState`, `StatusBadge`, `STATUS_META`.
- Produces:
  - `/estructural` → `StructuralPage`: título "Estructural"; región "Salud estructural" (puntaje `clampScore`, banda con icono + texto); región "Sensores en alerta" (enlaces al detalle con nivel y "N alerta(s)"; vacío: "No hay sensores estructurales en alerta."); región "Sensores estructurales" (lista con estado y enlace al detalle); panel de detalle.
  - `/consumos` → `ConsumptionPage`: título "Consumos"; "Periodo: del {fecha} al {fecha}"; una tarjeta por unidad (región con nombre "Consumo en {unidad}") con mes en curso, mismo tramo del mes anterior ("Sin datos" si es nulo), texto de variación (`describeVariation`, con `data-direction`) y gráfica de comparación (`role="img"`); región "Medidores" con enlaces al detalle de los sensores de consumo; vacío: "Aún no hay consumos registrados este mes."
  - `/aire` → `ComfortPage` para ambos roles: título "Calidad del aire"; nota "Basado en la concentración de CO₂ medida en cada zona."; lista de zonas con insignia (`COMFORT_TONE` → icono + "Buena/Regular/Mala"); ADMIN además ve "N ppm" y un enlace "Ver lecturas" al detalle del primer sensor de la zona; RESIDENTE no ve ppm ni enlaces.
  - `COMFORT_LABEL: Record<ComfortIndex, string>` ("Buena", "Regular", "Mala")
  - `RealtimeProvider.handleAlert` invalida además `queryKeys.dashboard.structural()`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/features/structural/StructuralPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openStructural() {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, '/estructural');
  return within(await screen.findByRole('region', { name: 'Salud estructural' }));
}

describe('página estructural', () => {
  it('en crítico: puntaje 60, banda y sensores en alerta', async () => {
    resetDb('critico');
    const health = await openStructural();
    expect(await health.findByText('60')).toBeInTheDocument();
    expect(health.getByText('Requiere atención')).toBeInTheDocument();
    const inAlert = screen.getByRole('region', { name: 'Sensores en alerta' });
    const link = await within(inAlert).findByRole('link', { name: /Acelerómetro Sótano Torre 1/ });
    expect(link).toHaveTextContent('Crítico');
    expect(link).toHaveTextContent('1 alerta');
    await userEvent.click(link);
    expect(await screen.findByRole('complementary', { name: 'Detalle del sensor' })).toBeInTheDocument();
  });

  it('en sano no hay sensores en alerta', async () => {
    const health = await openStructural();
    expect(await health.findByText('100')).toBeInTheDocument();
    expect(await screen.findByText('No hay sensores estructurales en alerta.')).toBeInTheDocument();
  });
});
```

`apps/web/src/features/consumption/ConsumptionPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openConsumption() {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, '/consumos');
  await screen.findByRole('heading', { name: 'Consumos', level: 1 });
}

describe('página de consumos', () => {
  it('muestra el mes en curso, el anterior y la variación', async () => {
    await openConsumption();
    const water = within(await screen.findByRole('region', { name: 'Consumo en m³' }));
    expect(water.getByText(/1\.234,5/)).toBeInTheDocument();
    expect(water.getByText('↑ 12,2 % frente al mismo tramo del mes anterior')).toHaveAttribute('data-direction', 'up');
    const power = within(screen.getByRole('region', { name: 'Consumo en kWh' }));
    expect(power.getByText('↓ 6,5 % frente al mismo tramo del mes anterior')).toHaveAttribute('data-direction', 'down');
    expect(water.getByRole('img', { name: /Comparación del consumo en m³/ })).toBeInTheDocument();
  });

  it('sin periodo anterior lo dice y nunca muestra 0 %', async () => {
    resetDb('caido');
    await openConsumption();
    const power = within(await screen.findByRole('region', { name: 'Consumo en kWh' }));
    expect(power.getByText('Sin datos del periodo anterior')).toBeInTheDocument();
    expect(power.queryByText(/0 %/)).not.toBeInTheDocument();
  });

  it('sin consumos muestra el estado vacío', async () => {
    resetDb('vacio');
    await openConsumption();
    expect(await screen.findByText('Aún no hay consumos registrados este mes.')).toBeInTheDocument();
  });
});
```

`apps/web/src/features/comfort/ComfortPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openComfort(who: 'admin' | 'residente') {
  const services = createTestServices();
  await loginAs(services, who);
  renderApp(services, '/aire');
  return within(await screen.findByRole('list', { name: 'Zonas' }));
}

describe('página de calidad del aire', () => {
  it('el administrador ve la etiqueta, los ppm y puede abrir las lecturas', async () => {
    resetDb('critico');
    const zones = await openComfort('admin');
    const salon = zones.getByRole('listitem', { name: 'Salón social' });
    expect(salon).toHaveTextContent('Mala');
    expect(salon).toHaveTextContent('1.450 ppm');
    await userEvent.click(within(salon).getByRole('link', { name: 'Ver lecturas de Salón social' }));
    expect(await screen.findByRole('complementary', { name: 'Detalle del sensor' })).toBeInTheDocument();
  });

  it('el residente solo ve la etiqueta: sin ppm, sin lecturas', async () => {
    resetDb('critico');
    const zones = await openComfort('residente');
    expect(zones.getByRole('listitem', { name: 'Salón social' })).toHaveTextContent('Mala');
    expect(screen.queryByText(/ppm/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver lecturas/ })).not.toBeInTheDocument();
  });

  it('el residente no puede abrir el detalle aunque ponga ?sensor= en la URL', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/aire?sensor=co2-salon');
    await screen.findByRole('list', { name: 'Zonas' });
    expect(screen.queryByRole('complementary', { name: 'Detalle del sensor' })).not.toBeInTheDocument();
  });
});
```

Añadir a `apps/web/src/features/realtime/RealtimeProvider.test.tsx` (sin tocar los existentes):
```tsx
  it('una alerta invalida también el dashboard estructural', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');
    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.structural() });
  });
```
(usar los imports ya presentes en el archivo: `homeReady`, `queryKeys`, `emitMockAlert`, `act`, `vi`).

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — las rutas muestran el marcador; módulos no encontrados.

- [ ] **Step 3: Implementar**

`apps/web/src/features/dashboards/Dashboards.module.css`:
```css
.page { display: grid; gap: var(--space-4); }
.page h1 { margin: 0; }
.intro { margin: var(--space-1) 0 0; color: var(--text-muted); }
.layout { display: grid; gap: var(--space-4); min-width: 0; }
@media (min-width: 1024px) {
  .layout[data-detail='open'] { grid-template-columns: minmax(0, 1fr) minmax(360px, 520px); align-items: start; }
}
.column { display: grid; gap: var(--space-4); min-width: 0; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-6); min-width: 0; }
.card h2 { margin: 0 0 var(--space-4); font-size: 1.125rem; }
.grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.score { margin: 0; font-size: 3rem; font-weight: 800; line-height: 1; }
.scoreMax { font-size: 1.25rem; color: var(--text-muted); font-weight: 600; }
.band { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: 999px; font-weight: 700; margin-top: var(--space-3); }
.band[data-tone='OK'] { color: var(--status-ok-fg); background: var(--status-ok-bg); }
.band[data-tone='WARNING'] { color: var(--status-warning-fg); background: var(--status-warning-bg); }
.band[data-tone='CRITICAL'] { color: var(--status-critical-fg); background: var(--status-critical-bg); }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
.list a { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; min-height: 44px; color: var(--text); text-decoration: none; padding: var(--space-2); border: 1px solid var(--border); border-radius: var(--radius); }
.list a:hover { border-color: var(--accent); }
.figures { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-4); margin: 0 0 var(--space-3); }
.figures dt { color: var(--text-muted); }
.figures dd { margin: 0; font-weight: 600; }
.variation { margin: 0 0 var(--space-3); font-weight: 600; }
.variation[data-direction='up'] { color: var(--status-warning-fg); }
.variation[data-direction='down'] { color: var(--status-ok-fg); }
.zone { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.zone strong { min-width: 0; overflow-wrap: anywhere; }
.zoneLink { min-height: 44px; display: inline-flex; align-items: center; color: var(--accent); font-weight: 600; }
.empty { color: var(--text-muted); margin: 0; }
```
(La variación ↑ en consumos se pinta en tono de advertencia y ↓ en tono normal: el texto con flecha lleva el significado; el color es secundario.)

`apps/web/src/features/structural/StructuralPage.tsx`:
```tsx
import { buildSensorStatusMap, clampScore, healthBand } from '@gd/domain';
import { POLL_INTERVALS_MS, useAlerts, useDashboardStructural, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataState } from '../../ui/DataState';
import { StatusBadge } from '../../ui/StatusBadge';
import { STATUS_META } from '../../ui/statusMeta';
import { useNow } from '../../ui/useNow';
import styles from '../dashboards/Dashboards.module.css';
import { BAND_LABEL, BAND_TONE } from '../home/healthCopy';
import { SensorDetailPanel } from '../sensors/SensorDetailPanel';
import { withSensorView } from '../sensors/sensorView';
import { useSensorSelection } from '../sensors/useSensorSelection';

export function StructuralPage() {
  const [params] = useSearchParams();
  const selection = useSensorSelection();
  const structural = useDashboardStructural();
  const sensors = useSensors();
  const alerts = useAlerts('ADMIN', {});
  const now = useNow();
  const structuralSensors = useMemo(() => (sensors.data?.data ?? []).filter((s) => s.category === 'structural'), [sensors.data]);
  const statuses = useMemo(
    () => buildSensorStatusMap(structuralSensors, alerts.data?.data ?? [], now),
    [structuralSensors, alerts.data, now],
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
            <ul className={styles.list}>
              {structuralSensors.map((sensor) => {
                const status = statuses.get(sensor.sensor_id);
                return (
                  <li key={sensor.sensor_id}>
                    <Link to={detailHref(sensor.sensor_id)}>
                      {status && <StatusBadge level={status.level} lastSeenAt={sensor.last_seen_at} now={now} />}
                      {sensor.name}
                    </Link>
                  </li>
                );
              })}
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
```

`apps/web/src/features/consumption/ConsumptionPage.tsx`:
```tsx
import { describeVariation, formatDate, formatNumber } from '@gd/domain';
import { POLL_INTERVALS_MS, useDashboardConsumption, useSensors } from '@gd/query';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataState } from '../../ui/DataState';
import { EChart } from '../../ui/chart/EChart';
import { buildComparisonOption } from '../../ui/chart/barOptions';
import { seriesPalette } from '../../ui/chart/palette';
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
  const palette = seriesPalette();

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
                        <EChart
                          option={buildComparisonOption({
                            unit: item.unit,
                            current: item.current_period,
                            previous: item.previous_period,
                            palette,
                          })}
                          label={`Comparación del consumo en ${item.unit}: mes en curso frente al mes anterior`}
                          height={200}
                        />
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
```
(`buildComparisonOption` se recalcula en cada render; envolver en `useMemo` por unidad si el implementador lo prefiere — no cambia el comportamiento.)

`apps/web/src/features/comfort/comfortCopy.ts`:
```ts
import type { ComfortIndex } from '@gd/domain';

export const COMFORT_LABEL: Record<ComfortIndex, string> = {
  BUENO: 'Buena',
  REGULAR: 'Regular',
  MALO: 'Mala',
};
```

`apps/web/src/features/comfort/ComfortPage.tsx`:
```tsx
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
  // El residente nunca abre el detalle, aunque la URL traiga ?sensor=.
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
```
(La insignia `.band` vive en `Dashboards.module.css`; el `margin-top` de `.band` puede ajustarse a 0 para la fila de zona con una clase adicional si se ve desalineado.)

En `apps/web/src/app/routes.tsx`: importar `StructuralPage`, `ConsumptionPage`, `ComfortPage` y reemplazar los marcadores de `estructural`, `consumos` y `aire`.

En `apps/web/src/features/realtime/RealtimeProvider.tsx`, en `handleAlert`, después de invalidar `dashboard.general()`:
```ts
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.structural() });
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint; pnpm --filter @gd/web build`
Expected: PASS. Si un test de rutas del Plan 1 buscaba el marcador "Calidad del aire" de `/aire`, sigue existiendo como `h1`.

- [ ] **Step 5: Commit**

```
git add apps/web/src
git commit -m "feat(web): páginas estructural, de consumos y de calidad del aire"
```

---

### Task 11: Filtros de alertas por sensor y por fechas

**Files:**
- Modify: `apps/web/src/features/alerts/alertFilters.ts`, `alertFilters.test.ts`, `AlertFiltersBar.tsx`, `AlertsPage.tsx`, `AlertsPage.test.tsx` (solo añadir tests)

**Interfaces:**
- Consumes: `bogotaDayStart`, `bogotaDateRange` (Task 1).
- Produces:
  - `AlertsView` gana `sensorId?: string` (parámetro `sensor`, misma regex que `alerta`), `from?: string`, `to?: string` (parámetros `desde`, `hasta` en `YYYY-MM-DD`, válidos solo si `bogotaDayStart` no es nulo). `writeAlertsView` escribe en orden `nivel, acusada, categoria, sensor, desde, hasta, alerta`.
  - `matchesClientFilters(alert: AlertResidente, view: AlertsView): boolean` (categoría, sensor y rango de fechas en hora de Bogotá; si `desde > hasta` se ignora el filtro de fechas)
  - `AlertFiltersBar({ view, onChange, sensorOptions })` gana el selector "Sensor" (opciones derivadas de las alertas cargadas) y los campos de fecha "Desde" y "Hasta" (`type="date"`); con `desde > hasta` muestra "La fecha inicial es posterior a la final; no se aplica el filtro de fechas."

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `apps/web/src/features/alerts/alertFilters.test.ts`:
```ts
import { matchesClientFilters } from './alertFilters';

describe('filtros de sensor y fechas', () => {
  it('lee y escribe sensor y fechas válidos', () => {
    const view = readAlertsView(new URLSearchParams('sensor=acc-t1-sotano&desde=2026-10-01&hasta=2026-10-02'));
    expect(view).toEqual({ sensorId: 'acc-t1-sotano', from: '2026-10-01', to: '2026-10-02' });
    expect(writeAlertsView({ ...view, level: 'CRITICAL', alertId: 'x' }).toString()).toBe(
      'nivel=CRITICAL&sensor=acc-t1-sotano&desde=2026-10-01&hasta=2026-10-02&alerta=x',
    );
  });

  it('ignora fechas inválidas y sensores maliciosos', () => {
    expect(readAlertsView(new URLSearchParams('sensor=%3Cx%3E&desde=2026-02-30&hasta=ayer'))).toEqual({});
  });

  it('filtra por sensor y por día de Bogotá; un rango invertido no filtra fechas', () => {
    const alert = {
      alert_id: 'a',
      building_id: 'b',
      sensor_id: 's1',
      level: 'WARNING' as const,
      category: 'structural',
      message: 'm',
      timestamp: '2026-10-02T04:30:00Z', // 1 oct, 11:30 p. m. en Bogotá
      acknowledged: false,
    };
    expect(matchesClientFilters(alert, { sensorId: 's1' })).toBe(true);
    expect(matchesClientFilters(alert, { sensorId: 's2' })).toBe(false);
    expect(matchesClientFilters(alert, { from: '2026-10-01', to: '2026-10-01' })).toBe(true);
    expect(matchesClientFilters(alert, { from: '2026-10-02' })).toBe(false);
    expect(matchesClientFilters(alert, { from: '2026-10-05', to: '2026-10-01' })).toBe(true);
  });
});
```
(reutilizar los imports `describe/expect/it`, `readAlertsView`, `writeAlertsView` ya presentes en el archivo).

Añadir a `apps/web/src/features/alerts/AlertsPage.test.tsx`:
```tsx
describe('filtros de sensor y fechas', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('filtra por sensor desde la URL', async () => {
    resetDb('critico');
    const list = await openAlerts('admin', '/alertas?sensor=acc-t1-sotano');
    // En crítico, acc-t1-sotano tiene exactamente una alerta (CRITICAL, ocurrencia 12).
    expect(list.getAllByRole('link')).toHaveLength(1);
    expect(list.getByRole('link')).toHaveTextContent('Crítico');
  });

  it('filtra por fechas en hora de Bogotá', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T18:00:00Z')); // 1:00 p. m. en Bogotá: las alertas sembradas caen el 2 oct
    resetDb('critico');
    const all = (await openAlerts('admin')).getAllByRole('link').length;
    cleanup();
    const today = await openAlerts('admin', '/alertas?desde=2026-10-02&hasta=2026-10-02');
    expect(today.getAllByRole('link')).toHaveLength(all);
    cleanup();
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/alertas?desde=2026-10-03');
    expect(await screen.findByText('No hay alertas con estos filtros.')).toBeInTheDocument();
  });

  it('un rango invertido avisa y no filtra', async () => {
    resetDb('critico');
    await openAlerts('admin', '/alertas?desde=2026-10-05&hasta=2026-10-01');
    expect(screen.getByText('La fecha inicial es posterior a la final; no se aplica el filtro de fechas.')).toBeInTheDocument();
  });
});
```
(añadir `afterEach`, `vi` al import de `vitest` y `cleanup` al de `@testing-library/react` si no están; `openAlerts` es el helper existente del archivo).

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — `matchesClientFilters` no existe; los filtros nuevos no se aplican.

- [ ] **Step 3: Implementar**

En `apps/web/src/features/alerts/alertFilters.ts`:
```ts
import type { AlertFilters, AlertResidente } from '@gd/api';
import { bogotaDateRange, bogotaDayStart, parseTimestamp, type AlertLevel } from '@gd/domain';

export interface AlertsView {
  level?: AlertLevel;
  acknowledged?: boolean;
  category?: Category;
  sensorId?: string;
  /** `YYYY-MM-DD` en hora de Bogotá. */
  from?: string;
  to?: string;
  alertId?: string;
}
```
En `readAlertsView`, después de `categoria`:
```ts
  const sensorId = params.get('sensor');
  if (sensorId !== null && ALERT_ID.test(sensorId)) view.sensorId = sensorId;
  const from = params.get('desde');
  if (from !== null && bogotaDayStart(from) !== null) view.from = from;
  const to = params.get('hasta');
  if (to !== null && bogotaDayStart(to) !== null) view.to = to;
```
En `writeAlertsView`, antes de `alerta`:
```ts
  if (view.sensorId) params.set('sensor', view.sensorId);
  if (view.from) params.set('desde', view.from);
  if (view.to) params.set('hasta', view.to);
```
Y añadir:
```ts
/** Rango invertido: se ignora el filtro de fechas (la UI lo avisa). */
export function datesInverted(view: AlertsView): boolean {
  const { from, to } = bogotaDateRange(view.from, view.to);
  return from !== null && to !== null && from >= to;
}

/** Categoría, sensor y fechas se filtran en el cliente (la API solo filtra nivel y estado). */
export function matchesClientFilters(alert: AlertResidente, view: AlertsView): boolean {
  if (view.category && alert.category !== view.category) return false;
  if (view.sensorId && alert.sensor_id !== view.sensorId) return false;
  if (!datesInverted(view)) {
    const { from, to } = bogotaDateRange(view.from, view.to);
    const time = parseTimestamp(alert.timestamp)?.getTime();
    if (time === undefined) return from === null && to === null;
    if (from !== null && time < from) return false;
    if (to !== null && time >= to) return false;
  }
  return true;
}
```

En `apps/web/src/features/alerts/AlertsPage.tsx`: reemplazar el filtro por categoría de `visibleAlerts` por `alerts.filter((a) => matchesClientFilters(a, view))`; calcular `sensorOptions` como los `sensor_id` únicos y ordenados de `query.data?.data ?? []`, y pasarlos a `AlertFiltersBar`.

En `apps/web/src/features/alerts/AlertFiltersBar.tsx`: añadir la prop `sensorOptions: string[]`; ampliar `set` para aceptar `'sensor' | 'desde' | 'hasta'`; añadir:
```tsx
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
```
y en `Alerts.module.css`:
```css
.filters input[type='date'] {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.hint { flex-basis: 100%; margin: 0; color: var(--status-warning-fg); font-weight: 600; }
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (los tests existentes de filtros siguen en verde).

- [ ] **Step 5: Commit**

```
git add apps/web/src/features/alerts
git commit -m "feat(web): filtros de alertas por sensor y por fechas en hora de Bogotá"
```

---

### Task 12: Pruebas E2E de dashboards, sensores y 390 px

**Files:**
- Create: `apps/web/e2e/sensors.spec.ts`, `apps/web/e2e/dashboards.spec.ts`, `apps/web/e2e/mobile-pages.spec.ts`

**Interfaces:**
- Consumes: app en modo mock; helpers `login`, `expectHome`, `waitForAppData`, `ADMIN`, `RESIDENTE`, `PASSWORD`.
- Produces: escenarios E2E en `tablet` y `escritorio` (y 390 px en `mobile-pages.spec.ts`).

- [ ] **Step 1: Escribir los specs**

`apps/web/e2e/sensors.spec.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, RESIDENTE, expectHome, login, waitForAppData } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('tabla de sensores → detalle con serie, rango y tabla alternativa', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sensores' }).click();
  const table = page.getByRole('table', { name: 'Sensores (22)' });
  await expect(table).toBeVisible();
  await table.getByRole('link', { name: 'Medidor acueducto principal' }).click();
  await expect(page).toHaveURL(/\/sensores\?sensor=water-main$/);
  const panel = page.getByRole('complementary', { name: 'Detalle del sensor' });
  await expect(panel.getByRole('img', { name: 'Serie de Medidor acueducto principal, 24 horas' })).toBeVisible();
  await panel.getByRole('button', { name: '7 días' }).click();
  await expect(page).toHaveURL(/rango=7d/);
  await expect(panel.getByRole('img', { name: 'Serie de Medidor acueducto principal, 7 días' })).toBeVisible();
  await panel.getByRole('button', { name: 'Ver como tabla' }).click();
  await expect(panel.getByRole('table', { name: 'Lecturas de Medidor acueducto principal' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('desde una alerta se llega al sensor', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.getByRole('region', { name: 'Alertas críticas sin revisar' }).getByRole('link', { name: 'Ver alerta' }).click();
  await page.getByRole('complementary', { name: 'Detalle de la alerta' }).getByRole('link', { name: 'Ver sensor' }).click();
  await expect(page).toHaveURL(/\/sensores\?sensor=acc-t1-sotano$/);
  await expect(page.getByRole('complementary', { name: 'Detalle del sensor' })).toContainText('Acelerómetro Sótano Torre 1');
});

test('el residente no puede entrar a sensores', async ({ page }) => {
  await login(page, RESIDENTE);
  await expectHome(page);
  await page.goto('/sensores');
  await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();
});
```
(el texto exacto del aviso de permiso es el que ya usa `RequireRole` del Plan 1; si difiere, usar ese).

`apps/web/e2e/dashboards.spec.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, RESIDENTE, expectHome, login } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('estructural en escenario crítico', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/estructural');
  const health = page.getByRole('region', { name: 'Salud estructural' });
  await expect(health).toContainText('60');
  await expect(health).toContainText('Requiere atención');
  await expect(page.getByRole('region', { name: 'Sensores en alerta' })).toContainText('Acelerómetro Sótano Torre 1');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('consumos con y sin periodo anterior', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=caido');
  await expectHome(page);
  await page.goto('/consumos');
  await expect(page.getByRole('region', { name: 'Consumo en m³' })).toContainText(
    '↑ 12,2 % frente al mismo tramo del mes anterior',
  );
  await expect(page.getByRole('region', { name: 'Consumo en kWh' })).toContainText('Sin datos del periodo anterior');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('calidad del aire: el administrador ve ppm; el residente no', async ({ page, browser }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/aire');
  await expect(page.getByRole('listitem', { name: 'Salón social' })).toContainText('1.450 ppm');

  const residentContext = await browser.newContext();
  const resident = await residentContext.newPage();
  await login(resident, RESIDENTE, PASSWORD, '/login?escenario=critico');
  await expectHome(resident);
  await resident.goto('/aire');
  const salon = resident.getByRole('listitem', { name: 'Salón social' });
  await expect(salon).toContainText('Mala');
  await expect(resident.getByText(/ppm/)).toHaveCount(0);
  const results = await new AxeBuilder({ page: resident }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
  await residentContext.close();
});

test('filtros de alertas por sensor viven en la URL', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/alertas');
  await page.getByLabel('Sensor').selectOption('acc-t1-sotano');
  await expect(page).toHaveURL(/sensor=acc-t1-sotano/);
  await expect(page.getByRole('list', { name: 'Alertas' }).getByRole('link')).toHaveCount(1);
});
```

`apps/web/e2e/mobile-pages.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, expectHome, login } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

for (const path of ['/sensores', '/estructural', '/consumos', '/aire', '/alertas']) {
  test(`a 390 px ${path} no tiene desplazamiento horizontal`, async ({ page }) => {
    await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
    await expectHome(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('a 390 px el detalle del sensor cabe y la gráfica se ve', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/sensores?sensor=water-main');
  const panel = page.getByRole('complementary', { name: 'Detalle del sensor' });
  await expect(panel.getByRole('img', { name: /Serie de Medidor acueducto principal/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```
(Las tablas anchas viven en contenedores con `overflow-x: auto`: el desplazamiento horizontal queda dentro de la tabla, no en la página.)

- [ ] **Step 2: Correr la suite E2E**

Run: `pnpm e2e`
Expected: todo en verde en `tablet` y `escritorio` (los specs de los Planes 1–2 incluidos). Esperas por condición (`toBeVisible`, `toContainText`), nunca `waitForTimeout`. Si `networkidle` es inestable por el polling, reemplazarlo por la espera de un elemento con datos de la página. Si axe reporta contraste en gráficas o insignias, corregir el token en `tokens.css`.

- [ ] **Step 3: Verificación completa**

Run: `pnpm lint; pnpm typecheck; pnpm test; pnpm e2e`
Expected: todo en verde; ningún servidor ni navegador queda corriendo. Comprobar en la salida de `pnpm --filter @gd/web build` que ECharts y el Worker están en *chunks* separados del bundle inicial.

- [ ] **Step 4: Commit**

```
git add apps/web/e2e
git commit -m "test(web): E2E de sensores, dashboards, filtros de alertas y 390 px"
```

---

## Cobertura del spec en este plan

| Spec | Cubierto en | Pendiente para |
|---|---|---|
| §5.3 Estado por sensor como modelo central (sensores, densidad, detalle) | Tasks 8, 9, 10 | Visor 3D (Plan 4) |
| §6.1 Densidad de sensores por zona en el home del ADMIN | Task 9 | — |
| §6.2 Estructural, Consumos (variación y `null`), Aire (ADMIN con ppm, residente solo etiqueta) | Tasks 3, 5, 10 | Reporte de consumo mensual (Plan 5, backend) |
| §6.3 Sensores: tabla filtrable y `SensorDetailPanel` compartido | Tasks 8, 9 | — |
| §8.1 Invalidar estructural y estado de sensores al llegar alertas y al acusar | Tasks 4, 10 | Eventos `sensor:status` del backend |
| §9.2 Series 1h/24h/7d/30d, tramos diarios, reducción en Worker, min/max y LTTB, tope y aviso, marcas de alertas, fisuras, "Ver como tabla" | Tasks 1, 2, 4, 6, 7, 8 | `intervalo` real del backend (pedido #1) |
| §10.1 Filtros de alertas por sensor y fechas (pendiente del Plan 2) | Task 11 | — |
| §11 Accesibilidad (gráficas con nombre y tabla, objetivos ≥44 px, 390 px) | Tasks 6, 8, 9, 10, 12 | — |
