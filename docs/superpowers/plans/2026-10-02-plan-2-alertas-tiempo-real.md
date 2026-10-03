# Plan 2 — Alertas y tiempo real

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el administrador y el residente vean las alertas en menos de 2 s por Socket.IO, las encuentren en ≤2 clics y que el administrador las marque como revisadas con actualización optimista, con indicadores honestos de conexión.

**Architecture:** Nuevo paquete portable `@gd/realtime` (cliente Socket.IO con reconexión por token, validación del payload por rol, sin APIs del navegador) detrás de la interfaz `RealtimeClient`. En `apps/web`, un `RealtimeProvider` conecta el cliente a la sesión, aplica cada `alert:new` a la caché de TanStack Query (helpers en `@gd/query`), dispara toasts, sonido y título de pestaña. El centro de alertas `/alertas` usa la URL como estado (filtros + `?alerta=`), y el acuse usa una mutación optimista con reversión. En modo mock, un `MockRealtimeClient` alimentado por un bus del backend simulado reemplaza al socket.

**Tech Stack:** Lo del Plan 1 (pnpm, Turborepo, TS 5.9, React 19, Vite 7, React Router 7, TanStack Query 5, Zod 4, MSW 2, Vitest 4, Playwright) + `socket.io-client@^4.8` + Web Audio API.

**Spec:** `docs/superpowers/specs/2026-10-02-gemelo-digital-front-design.md` (§6, §8, §10.1, §11, §12)

**Punto de partida:** `main` en `5b9c8a8` (Plan 1 completo). Interfaces existentes que este plan usa tal cual: `SessionManager` (`getAccessToken`, `refresh`, `subscribe`), `useSession()` (`status`, `session`), `createApi(http).alerts.{listAdmin,listResidente,ack}`, `useAlerts(role, filters)`, `queryKeys`, `POLL_INTERVALS_MS`, `DataState`, `StatusBadge`, `STATUS_META`, `Button`, `useNow`, `errorMessage`, `formatDateTime/formatRelative/formatNumber`, `compareAlertLevel`, mocks (`db`, `resetDb`, `authenticate`, `requireRole`, `errorResponse`, `server`, escenarios `sano|critico|caido|vacio`).

## Global Constraints

- Todo lo del Plan 1 sigue vigente: UI en español (Colombia); nunca "diagnóstico", "predicción" ni "riesgo de colapso"; fechas en `America/Bogota` con `es-CO`; TypeScript `strict` + `noUncheckedIndexedAccess`; prohibido `any` explícito y `dangerouslySetInnerHTML`; `packages/*` no usa `window`, `document`, `localStorage`, `sessionStorage`, `navigator` ni `location`.
- El RESIDENTE nunca recibe ni ve campos numéricos de medición (`value_triggered`, `threshold_configured`, `occurrence_count`) y no puede acusar alertas.
- Socket.IO en el mismo host (configurable), autenticación con `auth: { token }` usando el access token vigente; evento `alert:new`; solo llegan CRITICAL y WARNING (INFO se obtiene por polling).
- Al rotar el access token se reconecta el socket con el token nuevo; al reconectar se invalidan `alerts` y `dashboard/general`.
- CRITICAL → toast persistente (hasta cerrarlo o abrir la alerta) + sonido + región `role="alert"`. WARNING → toast de 8 s, sin sonido, región `role="status"`.
- Acuse: botón **"Marcar como revisada"**, diálogo de confirmación con el texto **"Esto no resuelve la condición; si persiste, se volverá a registrar."**, actualización optimista y reversión con mensaje si falla. Sin acuse masivo.
- Una alerta crítica a ≤2 clics desde cualquier pantalla (toast → 1 clic; campana → lista → alerta = 2; banner del home → 1).
- Contrato estricto (ruling R5 del Plan 1): todo payload (HTTP o socket) se valida con el schema del rol; un payload fuera de contrato se reporta y se descarta, nunca se pinta crudo.
- Todo estado se comunica con color + icono + texto; el indicador de conexión nunca dice "En vivo" si no hay socket conectado.

## Review Focus

1. **La misma alerta llega dos veces por socket** (nueva ocurrencia, mismo `alert_id`): una sola fila en cada lista, `occurrence_count` actualizado y un solo toast (reemplazado, no duplicado). → tests en Task 2, Task 4 y Task 5.
2. **Payload de socket fuera de contrato o con forma de otro rol**: se ignora, se reporta y no rompe la app; el residente nunca recibe números aunque el servidor los mande. → test en Task 3.
3. **Rotación del token cada ~13 min con el socket conectado**: reconecta con el token nuevo sin pasar por `disconnected` y sin mostrar el banner "Sin conexión". → tests en Task 3 y Task 8.
4. **El navegador bloquea el audio** (política de autoplay): ninguna excepción; la cabecera muestra "Activar sonido" y al pulsarlo se desbloquea. → tests en Task 6 y Task 8.
5. **URL de alertas con parámetros inválidos o `?alerta=` inexistente/malicioso**: la vista carga con valores por defecto o muestra "No encontramos esta alerta", sin errores. → tests en Task 9 y Task 10.

---

## Estructura de archivos

```
packages/
├─ domain/src/   alertOrder.ts (+test)                          ← orden de bandeja
├─ api/src/schemas/alerts.ts  (+ isAdminAlert) · alerts.test.ts
├─ query/src/    alertCache.ts (+test) · mutations.ts · mutations.test.tsx
└─ realtime/     package.json · tsconfig.json
   └─ src/       socket.ts · client.ts · idle.ts · index.ts · client.test.ts
apps/web/src/
├─ app/          services.ts (factory de tiempo real) · AppProviders.tsx · config.ts · routes.tsx
│  ├─ connection/ useOnlineStatus.ts · useLastDataUpdate.ts · connectionState.ts (+test)
│  │              useConnection.ts · ConnectionIndicator.tsx · OfflineBanner.tsx · Connection.module.css
│  └─ layout/    AppShell.tsx · Header.tsx · AlertsBell.tsx · SoundButton.tsx · AppShell.module.css
├─ features/realtime/ RealtimeProvider.tsx · alertToast.ts · alertSound.ts · titleBadge.ts (+tests)
├─ features/alerts/   AlertsPage.tsx · AlertFiltersBar.tsx · AlertList.tsx · AlertDetailPanel.tsx
│                     alertFilters.ts · alertCopy.ts · Alerts.module.css (+tests)
├─ ui/           toast/ToastProvider.tsx · toast/Toast.module.css · ConfirmDialog.tsx · ConfirmDialog.module.css
├─ mocks/        realtimeBus.ts · realtime.ts · emit.ts · serialize.ts · DevPanel.tsx · DevPanel.module.css
│                handlers/alerts.ts (ack) · db.ts (failNextAck) · browser.ts (__gdMocks) · realtime.test.ts
└─ test/         setup.ts · renderApp.tsx
apps/web/e2e/    alerts.spec.ts · realtime.spec.ts
```

---

### Task 1: Orden de bandeja y distinción de alertas de administrador

**Files:**
- Create: `packages/domain/src/alertOrder.ts`, `packages/domain/src/alertOrder.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/api/src/schemas/alerts.ts`
- Create: `packages/api/src/schemas/alerts.test.ts`

**Interfaces:**
- Consumes: `compareAlertLevel`, `AlertLevel`, `parseTimestamp` (`@gd/domain`); `AlertResidente`, `AlertAdmin` (`@gd/api`).
- Produces:
  - `interface InboxAlert { level: AlertLevel; acknowledged: boolean; timestamp: string }`
  - `compareInboxAlerts(a: InboxAlert, b: InboxAlert): number` — sin revisar primero, luego más severa, luego más reciente; fecha inválida = más antigua.
  - `sortAlertsForInbox<T extends InboxAlert>(alerts: readonly T[]): T[]` (no muta la entrada)
  - `isAdminAlert(alert: AlertResidente): alert is AlertAdmin` (exportada desde `@gd/api`)

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/alertOrder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { AlertLevel } from './levels';
import { sortAlertsForInbox } from './alertOrder';

const a = (id: string, level: AlertLevel, acknowledged: boolean, timestamp: string) => ({
  id,
  level,
  acknowledged,
  timestamp,
});

describe('sortAlertsForInbox', () => {
  it('pone primero las sin revisar, luego las más severas y luego las más recientes', () => {
    const list = [
      a('info-new', 'INFO', false, '2026-10-02T15:00:00Z'),
      a('crit-acked', 'CRITICAL', true, '2026-10-02T16:00:00Z'),
      a('warn-old', 'WARNING', false, '2026-10-02T10:00:00Z'),
      a('crit-old', 'CRITICAL', false, '2026-10-02T09:00:00Z'),
      a('crit-new', 'CRITICAL', false, '2026-10-02T14:00:00Z'),
    ];
    expect(sortAlertsForInbox(list).map((x) => x.id)).toEqual([
      'crit-new',
      'crit-old',
      'warn-old',
      'info-new',
      'crit-acked',
    ]);
  });

  it('no modifica el arreglo original', () => {
    const list = [a('b', 'INFO', false, '2026-10-02T10:00:00Z'), a('a', 'CRITICAL', false, '2026-10-02T10:00:00Z')];
    const copy = [...list];
    sortAlertsForInbox(list);
    expect(list).toEqual(copy);
  });

  it('una fecha inválida queda al final de su grupo', () => {
    const list = [a('bad', 'WARNING', false, 'no-es-fecha'), a('ok', 'WARNING', false, '2026-10-02T10:00:00Z')];
    expect(sortAlertsForInbox(list).map((x) => x.id)).toEqual(['ok', 'bad']);
  });
});
```

`packages/api/src/schemas/alerts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { alertAdminSchema, alertResidenteSchema, isAdminAlert } from './alerts';

const base = {
  alert_id: 'alrt-20261002-00001',
  building_id: 'bld-1',
  sensor_id: 's1',
  level: 'CRITICAL',
  category: 'structural',
  message: 'm',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
};

describe('isAdminAlert', () => {
  it('reconoce la forma de administrador', () => {
    const admin = alertAdminSchema.parse({
      ...base,
      value_triggered: 1,
      threshold_configured: 0.5,
      occurrence_count: 2,
      acknowledged_by: null,
      acknowledged_at: null,
    });
    expect(isAdminAlert(admin)).toBe(true);
  });
  it('la forma de residente no es de administrador', () => {
    expect(isAdminAlert(alertResidenteSchema.parse(base))).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/domain test; pnpm --filter @gd/api test`
Expected: FAIL — no se resuelve `./alertOrder`; `isAdminAlert` no está exportada.

- [ ] **Step 3: Implementar**

`packages/domain/src/alertOrder.ts`:
```ts
import { compareAlertLevel, type AlertLevel } from './levels';
import { parseTimestamp } from './time';

export interface InboxAlert {
  level: AlertLevel;
  acknowledged: boolean;
  timestamp: string;
}

function timeValue(iso: string): number {
  return parseTimestamp(iso)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/** Bandeja de alertas: primero sin revisar, luego más severas, luego más recientes. */
export function compareInboxAlerts(a: InboxAlert, b: InboxAlert): number {
  if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
  const bySeverity = compareAlertLevel(a.level, b.level);
  if (bySeverity !== 0) return bySeverity;
  const ta = timeValue(a.timestamp);
  const tb = timeValue(b.timestamp);
  if (ta === tb) return 0;
  return tb > ta ? 1 : -1;
}

export function sortAlertsForInbox<T extends InboxAlert>(alerts: readonly T[]): T[] {
  return [...alerts].sort(compareInboxAlerts);
}
```

Añadir a `packages/domain/src/index.ts`:
```ts
export * from './alertOrder';
```

Añadir al final de `packages/api/src/schemas/alerts.ts`:
```ts
/** En runtime, el ADMIN recibe campos extra; se distinguen por `occurrence_count`. */
export function isAdminAlert(alert: AlertResidente): alert is AlertAdmin {
  return typeof (alert as Partial<AlertAdmin>).occurrence_count === 'number';
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/domain test; pnpm --filter @gd/api test; pnpm typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add packages/domain packages/api
git commit -m "feat(domain,api): orden de bandeja de alertas e isAdminAlert"
```

---

### Task 2: Caché de alertas y acuse optimista (`@gd/query`)

**Files:**
- Create: `packages/query/src/alertCache.ts`, `packages/query/src/alertCache.test.ts`
- Create: `packages/query/src/mutations.ts`, `packages/query/src/mutations.test.tsx`
- Modify: `packages/query/src/index.ts`

**Interfaces:**
- Consumes: `AlertFilters`, `AlertListResidente`, `AlertResidente`, `AlertAdmin`, `Role`, `Api` (`@gd/api`); `queryKeys`, `useApi` (`@gd/query`).
- Produces:
  - `matchesAlertFilters(alert: AlertResidente, filters: AlertFilters): boolean`
  - `upsertAlertList<T extends AlertResidente>(list: { count: number; data: T[] }, alert: T, filters: AlertFilters): { count: number; data: T[] }` — reemplaza por `alert_id`, quita si ya no cumple el filtro, ordena por `timestamp` desc.
  - `markAlertAcknowledged<T extends AlertResidente>(list: { count: number; data: T[] }, alertId: string): { count: number; data: T[] }`
  - `applyAlertToCache(queryClient: QueryClient, role: Role, alert: AlertResidente): void` — aplica a todas las listas cacheadas `['gd','alerts',role,filters]`.
  - `useAckAlert(): UseMutationResult<AlertAdmin, unknown, string, AckContext>` — optimista sobre todas las listas `['gd','alerts',…]`, revierte en error, aplica la versión del servidor en éxito e invalida `alerts` y `dashboard/general` al terminar.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/query/src/alertCache.test.ts`:
```ts
import type { AlertListAdmin, AlertAdmin } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { applyAlertToCache, markAlertAcknowledged, upsertAlertList } from './alertCache';
import { queryKeys } from './keys';

const alert = (id: string, overrides: Partial<AlertAdmin> = {}): AlertAdmin => ({
  alert_id: id,
  building_id: 'bld-1',
  sensor_id: 's1',
  level: 'CRITICAL',
  category: 'structural',
  message: 'm',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 1,
  threshold_configured: 0.5,
  occurrence_count: 1,
  acknowledged_by: null,
  acknowledged_at: null,
  ...overrides,
});

describe('upsertAlertList', () => {
  it('inserta una alerta nueva que cumple el filtro, ordenada por fecha desc', () => {
    const list = { count: 1, data: [alert('a', { timestamp: '2026-10-02T10:00:00Z' })] };
    const next = upsertAlertList(list, alert('b', { timestamp: '2026-10-02T12:00:00Z' }), { acknowledged: false });
    expect(next.data.map((x) => x.alert_id)).toEqual(['b', 'a']);
    expect(next.count).toBe(2);
  });

  it('reemplaza por alert_id en vez de duplicar (nueva ocurrencia)', () => {
    const list = { count: 1, data: [alert('a', { occurrence_count: 1 })] };
    const next = upsertAlertList(list, alert('a', { occurrence_count: 2 }), {});
    expect(next.data).toHaveLength(1);
    expect(next.data[0]?.occurrence_count).toBe(2);
  });

  it('quita la alerta si ya no cumple el filtro', () => {
    const list = { count: 1, data: [alert('a')] };
    const next = upsertAlertList(list, alert('a', { acknowledged: true }), { acknowledged: false });
    expect(next.data).toHaveLength(0);
    expect(next.count).toBe(0);
  });

  it('respeta el filtro de nivel', () => {
    const list = { count: 0, data: [] as AlertAdmin[] };
    expect(upsertAlertList(list, alert('w', { level: 'WARNING' }), { level: 'CRITICAL' }).data).toHaveLength(0);
  });
});

describe('markAlertAcknowledged', () => {
  it('marca solo la alerta indicada', () => {
    const list = { count: 2, data: [alert('a'), alert('b')] };
    const next = markAlertAcknowledged(list, 'b');
    expect(next.data.map((x) => x.acknowledged)).toEqual([false, true]);
  });
});

describe('applyAlertToCache', () => {
  it('actualiza todas las listas del rol y no toca las del otro rol', () => {
    const client = new QueryClient();
    const unacked = queryKeys.alerts.list('ADMIN', { acknowledged: false });
    const all = queryKeys.alerts.list('ADMIN', {});
    const residente = queryKeys.alerts.list('RESIDENTE', {});
    client.setQueryData<AlertListAdmin>(unacked, { count: 0, data: [] });
    client.setQueryData<AlertListAdmin>(all, { count: 0, data: [] });
    client.setQueryData(residente, { count: 0, data: [] });

    applyAlertToCache(client, 'ADMIN', alert('n1'));

    expect(client.getQueryData<AlertListAdmin>(unacked)?.data.map((x) => x.alert_id)).toEqual(['n1']);
    expect(client.getQueryData<AlertListAdmin>(all)?.data.map((x) => x.alert_id)).toEqual(['n1']);
    expect(client.getQueryData<AlertListAdmin>(residente)?.data).toEqual([]);
  });
});
```

`packages/query/src/mutations.test.tsx`:
```tsx
import type { AlertAdmin, AlertListAdmin, Api } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { queryKeys } from './keys';
import { useAckAlert } from './mutations';

const pendingAlert: AlertAdmin = {
  alert_id: 'alrt-20261002-00004',
  building_id: 'bld-1',
  sensor_id: 'acc-t1-sotano',
  level: 'CRITICAL',
  category: 'structural',
  message: 'Aceleración superior al umbral configurado',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 0.35,
  threshold_configured: 0.2,
  occurrence_count: 12,
  acknowledged_by: null,
  acknowledged_at: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(ack: (alertId: string) => Promise<AlertAdmin>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const api = { alerts: { ack: vi.fn(ack) } } as unknown as Api;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

const unackedKey = queryKeys.alerts.list('ADMIN', { acknowledged: false });
const allKey = queryKeys.alerts.list('ADMIN', {});

describe('useAckAlert', () => {
  it('marca la alerta como revisada antes de que responda el servidor y luego aplica su versión', async () => {
    const server = deferred<AlertAdmin>();
    const { client, wrapper } = setup(() => server.promise);
    client.setQueryData<AlertListAdmin>(unackedKey, { count: 1, data: [pendingAlert] });
    client.setQueryData<AlertListAdmin>(allKey, { count: 1, data: [pendingAlert] });

    const { result } = renderHook(() => useAckAlert(), { wrapper });
    act(() => result.current.mutate(pendingAlert.alert_id));

    await waitFor(() => expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(unackedKey)?.data[0]?.acknowledged).toBe(true);

    server.resolve({ ...pendingAlert, acknowledged: true, acknowledged_by: 'Administración Demo', acknowledged_at: '2026-10-02T15:05:00Z' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged_by).toBe('Administración Demo');
    expect(client.getQueryData<AlertListAdmin>(unackedKey)?.data).toHaveLength(0);
  });

  it('revierte si el servidor falla', async () => {
    const { client, wrapper } = setup(() => Promise.reject(new Error('fallo simulado')));
    client.setQueryData<AlertListAdmin>(allKey, { count: 1, data: [pendingAlert] });

    const { result } = renderHook(() => useAckAlert(), { wrapper });
    act(() => result.current.mutate(pendingAlert.alert_id));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<AlertListAdmin>(allKey)?.data[0]?.acknowledged).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/query test`
Expected: FAIL — no se resuelven `./alertCache` ni `./mutations`.

- [ ] **Step 3: Implementar**

`packages/query/src/alertCache.ts`:
```ts
import type { AlertFilters, AlertListResidente, AlertResidente, Role } from '@gd/api';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

type AlertList<T> = { count: number; data: T[] };

export function matchesAlertFilters(alert: AlertResidente, filters: AlertFilters): boolean {
  if (filters.level !== undefined && alert.level !== filters.level) return false;
  if (filters.acknowledged !== undefined && alert.acknowledged !== filters.acknowledged) return false;
  return true;
}

/** Inserta o reemplaza por `alert_id` respetando los filtros de la lista; orden por fecha descendente. */
export function upsertAlertList<T extends AlertResidente>(list: AlertList<T>, alert: T, filters: AlertFilters): AlertList<T> {
  const rest = list.data.filter((item) => item.alert_id !== alert.alert_id);
  const data = matchesAlertFilters(alert, filters) ? [alert, ...rest] : rest;
  data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { count: data.length, data };
}

export function markAlertAcknowledged<T extends AlertResidente>(list: AlertList<T>, alertId: string): AlertList<T> {
  return {
    count: list.count,
    data: list.data.map((item) => (item.alert_id === alertId ? { ...item, acknowledged: true } : item)),
  };
}

function filtersFromKey(key: readonly unknown[]): AlertFilters {
  const filters = key[3];
  return typeof filters === 'object' && filters !== null ? (filters as AlertFilters) : {};
}

/** Aplica una alerta (llegada por socket o devuelta por la API) a todas las listas cacheadas de ese rol. */
export function applyAlertToCache(queryClient: QueryClient, role: Role, alert: AlertResidente): void {
  const entries = queryClient.getQueriesData<AlertListResidente>({ queryKey: [...queryKeys.alerts.all(), role] });
  for (const [key, list] of entries) {
    if (!list) continue;
    queryClient.setQueryData(key, upsertAlertList(list, alert, filtersFromKey(key)));
  }
}
```

`packages/query/src/mutations.ts`:
```ts
import type { AlertAdmin, AlertListResidente } from '@gd/api';
import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from '@tanstack/react-query';
import { useApi } from './ApiContext';
import { applyAlertToCache, markAlertAcknowledged } from './alertCache';
import { queryKeys } from './keys';

export interface AckContext {
  snapshot: [QueryKey, AlertListResidente | undefined][];
}

/** Acuse optimista: la alerta pasa a revisada al instante y se revierte si el servidor falla. */
export function useAckAlert(): UseMutationResult<AlertAdmin, unknown, string, AckContext> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<AlertAdmin, unknown, string, AckContext>({
    mutationFn: (alertId) => api.alerts.ack(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.alerts.all() });
      const snapshot = queryClient.getQueriesData<AlertListResidente>({ queryKey: queryKeys.alerts.all() });
      for (const [key, list] of snapshot) {
        if (list) queryClient.setQueryData(key, markAlertAcknowledged(list, alertId));
      }
      return { snapshot };
    },
    onError: (_error, _alertId, context) => {
      for (const [key, list] of context?.snapshot ?? []) queryClient.setQueryData(key, list);
    },
    onSuccess: (updated) => applyAlertToCache(queryClient, 'ADMIN', updated),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() }),
      ]),
  });
}
```

Añadir a `packages/query/src/index.ts`:
```ts
export * from './alertCache';
export * from './mutations';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/query test; pnpm --filter @gd/query typecheck; pnpm lint`
Expected: PASS, salida limpia. Si la firma de los callbacks de `useMutation` de la versión instalada de TanStack Query difiere (4.º parámetro de `onError`), ajustar solo la firma del callback manteniendo el comportamiento.

- [ ] **Step 5: Commit**

```
git add packages/query
git commit -m "feat(query): caché de alertas y acuse optimista con reversión"
```

---

### Task 3: Cliente de tiempo real (`@gd/realtime`)

**Files:**
- Create: `packages/realtime/package.json`, `packages/realtime/tsconfig.json`
- Create: `packages/realtime/src/socket.ts`, `packages/realtime/src/client.ts`, `packages/realtime/src/idle.ts`, `packages/realtime/src/index.ts`
- Test: `packages/realtime/src/client.test.ts`

**Interfaces:**
- Consumes: `alertAdminSchema`, `alertResidenteSchema`, `AlertResidente`, `Role`, `Scheduler` (`@gd/api`).
- Produces:
  - `type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'`
  - `interface RealtimeClient { start(): void; stop(): void; tokenChanged(): void; getStatus(): RealtimeStatus; onStatus(listener: (s: RealtimeStatus) => void): () => void; onAlert(listener: (alert: AlertResidente) => void): () => void }`
  - `ALERT_EVENT = 'alert:new'`; `AUTH_RETRY_DELAYS_MS = [0, 2_000, 10_000, 30_000]`
  - `interface RealtimeClientOptions { url: string; path?: string; role: Role; getAccessToken(): string | null; refreshAccessToken(): Promise<boolean>; socketFactory?: SocketFactory; scheduler?: Scheduler; onInvalidPayload?(payload: unknown): void }`
  - `createRealtimeClient(options: RealtimeClientOptions): RealtimeClient`
  - `createIdleRealtimeClient(): RealtimeClient` (siempre `idle`; para configuraciones sin tiempo real)
  - `type SocketListener = (...args: unknown[]) => void`; `interface SocketLike { readonly connected: boolean; readonly active: boolean; connect(): void; disconnect(): void; on(event: string, l: SocketListener): void; off(event: string, l: SocketListener): void }`; `type SocketFactory = (o: { url: string; path: string; getToken(): string | null }) => SocketLike`; `ioSocketFactory: SocketFactory`
- Semántica: el token viaja en el handshake (`auth` como función evaluada en cada (re)conexión). `disconnect` iniciado por el cliente no cambia el estado. Error de conexión con `active === true` → `reconnecting` (socket.io reintenta solo). Error con `active === false` (rechazo del servidor, p. ej. token vencido) → reintento manual con `refreshAccessToken()` según `AUTH_RETRY_DELAYS_MS`; agotados → `disconnected` hasta `tokenChanged()`.

- [ ] **Step 1: Crear el paquete**

`packages/realtime/package.json`:
```json
{
  "name": "@gd/realtime",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" }
}
```

`packages/realtime/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023", "DOM"] },
  "include": ["src"]
}
```

Run:
```
pnpm --filter @gd/realtime add @gd/api@workspace:* socket.io-client@^4.8
pnpm --filter @gd/realtime add -D vitest@^4 typescript@~5.9.3
```

- [ ] **Step 2: Escribir el test que falla**

`packages/realtime/src/client.test.ts`:
```ts
import type { Scheduler } from '@gd/api';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_RETRY_DELAYS_MS, createRealtimeClient, type RealtimeStatus } from './client';
import type { SocketLike, SocketListener } from './socket';

class FakeSocket implements SocketLike {
  connected = false;
  active = false;
  disconnectCalls = 0;
  tokensSent: (string | null)[] = [];
  private readonly getToken: () => string | null;
  private readonly listeners = new Map<string, Set<SocketListener>>();

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
  }
  connect() {
    this.active = true;
    this.tokensSent.push(this.getToken());
  }
  disconnect() {
    this.disconnectCalls++;
    const wasConnected = this.connected;
    this.connected = false;
    this.active = false;
    if (wasConnected) this.emit('disconnect', 'io client disconnect');
  }
  on(event: string, listener: SocketListener) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }
  off(event: string, listener: SocketListener) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
  }
  serverAccepts() {
    this.connected = true;
    this.emit('connect');
  }
  serverRejects() {
    this.connected = false;
    this.active = false;
    this.emit('connect_error', new Error('unauthorized'));
  }
  transportDrops() {
    this.connected = false;
    this.active = true;
    this.emit('disconnect', 'transport close');
  }
}

class FakeScheduler implements Scheduler {
  tasks: { id: number; fn: () => void; ms: number }[] = [];
  private nextId = 1;
  setTimeout(fn: () => void, ms: number) {
    const id = this.nextId++;
    this.tasks.push({ id, fn, ms });
    return id;
  }
  clearTimeout(handle: unknown) {
    this.tasks = this.tasks.filter((t) => t.id !== handle);
  }
  runAll() {
    const pending = this.tasks;
    this.tasks = [];
    pending.forEach((t) => t.fn());
  }
}

const adminPayload = {
  alert_id: 'alrt-20261002-00009',
  building_id: 'bld-1',
  sensor_id: 'acc-t1-sotano',
  level: 'CRITICAL',
  category: 'structural',
  message: 'Aceleración superior al umbral configurado',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 0.41,
  threshold_configured: 0.2,
  occurrence_count: 1,
  acknowledged_by: null,
  acknowledged_at: null,
};

function setup(options: { role?: 'ADMIN' | 'RESIDENTE'; token?: string | null; refresh?: () => Promise<boolean> } = {}) {
  const state = { token: options.token === undefined ? 't1' : options.token };
  const sockets: FakeSocket[] = [];
  const scheduler = new FakeScheduler();
  const statuses: RealtimeStatus[] = [];
  const onInvalidPayload = vi.fn();
  const refreshAccessToken = vi.fn(
    options.refresh ??
      (async () => {
        state.token = 't2';
        return true;
      }),
  );
  const client = createRealtimeClient({
    url: 'http://api.test',
    role: options.role ?? 'ADMIN',
    getAccessToken: () => state.token,
    refreshAccessToken,
    scheduler,
    onInvalidPayload,
    socketFactory: ({ getToken }) => {
      const socket = new FakeSocket(getToken);
      sockets.push(socket);
      return socket;
    },
  });
  client.onStatus((s) => statuses.push(s));
  const socket = () => {
    const s = sockets[0];
    if (!s) throw new Error('no se creó el socket');
    return s;
  };
  return { client, state, sockets, socket, scheduler, statuses, onInvalidPayload, refreshAccessToken };
}

describe('createRealtimeClient', () => {
  it('sin token no crea socket y queda desconectado', () => {
    const { client, sockets } = setup({ token: null });
    client.start();
    expect(sockets).toHaveLength(0);
    expect(client.getStatus()).toBe('disconnected');
  });

  it('conecta enviando el token en el handshake', () => {
    const { client, socket, statuses } = setup();
    client.start();
    expect(socket().tokensSent).toEqual(['t1']);
    socket().serverAccepts();
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('valida alert:new con el schema del rol de administrador', () => {
    const { client, socket } = setup();
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().serverAccepts();
    socket().emit('alert:new', adminPayload);
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ alert_id: adminPayload.alert_id, occurrence_count: 1 }));
  });

  it('al residente nunca le entrega campos numéricos aunque el servidor los mande', () => {
    const { client, socket } = setup({ role: 'RESIDENTE' });
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().emit('alert:new', adminPayload);
    const alert = received.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(alert).not.toHaveProperty('value_triggered');
    expect(alert).not.toHaveProperty('threshold_configured');
    expect(alert).not.toHaveProperty('occurrence_count');
  });

  it('descarta y reporta un payload fuera de contrato', () => {
    const { client, socket, onInvalidPayload } = setup();
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().emit('alert:new', { alert_id: 1, level: 'PANICO' });
    expect(received).not.toHaveBeenCalled();
    expect(onInvalidPayload).toHaveBeenCalledTimes(1);
  });

  it('una caída de transporte pasa a reconnecting sin reintento manual', () => {
    const { client, socket, scheduler } = setup();
    client.start();
    socket().serverAccepts();
    socket().transportDrops();
    expect(client.getStatus()).toBe('reconnecting');
    expect(scheduler.tasks).toHaveLength(0);
    socket().serverAccepts();
    expect(client.getStatus()).toBe('connected');
  });

  it('si el servidor rechaza el handshake renueva el token y reintenta', async () => {
    const { client, socket, scheduler, refreshAccessToken } = setup();
    client.start();
    socket().serverRejects();
    expect(client.getStatus()).toBe('reconnecting');
    expect(scheduler.tasks[0]?.ms).toBe(AUTH_RETRY_DELAYS_MS[0]);
    scheduler.runAll();
    await vi.waitFor(() => expect(socket().tokensSent).toEqual(['t1', 't2']));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras agotar los reintentos y queda desconectado', async () => {
    const { client, socket, scheduler } = setup();
    client.start();
    for (let attempt = 0; attempt < AUTH_RETRY_DELAYS_MS.length; attempt++) {
      socket().serverRejects();
      scheduler.runAll();
      await vi.waitFor(() => expect(socket().tokensSent).toHaveLength(attempt + 2));
    }
    socket().serverRejects();
    expect(client.getStatus()).toBe('disconnected');
    expect(scheduler.tasks).toHaveLength(0);
  });

  it('si el refresh falla y no queda token, queda desconectado', async () => {
    const { client, socket, scheduler, state } = setup({
      refresh: async () => {
        state.token = null;
        return false;
      },
    });
    client.start();
    socket().serverRejects();
    scheduler.runAll();
    await vi.waitFor(() => expect(client.getStatus()).toBe('disconnected'));
    expect(socket().tokensSent).toEqual(['t1']);
  });

  it('tokenChanged reconecta con el token nuevo sin pasar por disconnected', () => {
    const { client, socket, statuses, state } = setup();
    client.start();
    socket().serverAccepts();
    state.token = 't9';
    client.tokenChanged();
    expect(socket().tokensSent).toEqual(['t1', 't9']);
    expect(statuses).not.toContain('disconnected');
    socket().serverAccepts();
    expect(client.getStatus()).toBe('connected');
  });

  it('stop desconecta, limpia reintentos e ignora eventos posteriores', () => {
    const { client, socket, scheduler } = setup();
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().serverRejects();
    client.stop();
    expect(scheduler.tasks).toHaveLength(0);
    expect(client.getStatus()).toBe('idle');
    socket().emit('alert:new', adminPayload);
    expect(received).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm --filter @gd/realtime test`
Expected: FAIL — no se resuelven `./client` ni `./socket`.

- [ ] **Step 4: Implementar**

`packages/realtime/src/socket.ts`:
```ts
import { io } from 'socket.io-client';

export type SocketListener = (...args: unknown[]) => void;

/** Lo mínimo de un socket de Socket.IO que usa el cliente (permite probarlo sin servidor). */
export interface SocketLike {
  readonly connected: boolean;
  /** true mientras socket.io seguirá intentando reconectar por su cuenta. */
  readonly active: boolean;
  connect(): void;
  disconnect(): void;
  on(event: string, listener: SocketListener): void;
  off(event: string, listener: SocketListener): void;
}

export interface SocketFactoryOptions {
  url: string;
  path: string;
  getToken: () => string | null;
}

export type SocketFactory = (options: SocketFactoryOptions) => SocketLike;

export const ioSocketFactory: SocketFactory = ({ url, path, getToken }) => {
  const socket = io(url, {
    path,
    autoConnect: false,
    transports: ['websocket', 'polling'],
    // Se evalúa en cada (re)conexión: siempre viaja el access token vigente.
    auth: (cb) => cb({ token: getToken() }),
  });
  return {
    get connected() {
      return socket.connected;
    },
    get active() {
      return socket.active;
    },
    connect: () => {
      socket.connect();
    },
    disconnect: () => {
      socket.disconnect();
    },
    on: (event, listener) => {
      socket.on(event, listener);
    },
    off: (event, listener) => {
      socket.off(event, listener);
    },
  };
};
```

`packages/realtime/src/client.ts`:
```ts
import { alertAdminSchema, alertResidenteSchema, type AlertResidente, type Role, type Scheduler } from '@gd/api';
import { ioSocketFactory, type SocketFactory, type SocketLike, type SocketListener } from './socket';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RealtimeClient {
  start(): void;
  stop(): void;
  /** El access token cambió (refresh): reconectar para que el servidor vea el nuevo. */
  tokenChanged(): void;
  getStatus(): RealtimeStatus;
  onStatus(listener: (status: RealtimeStatus) => void): () => void;
  onAlert(listener: (alert: AlertResidente) => void): () => void;
}

export const ALERT_EVENT = 'alert:new';
/** Esperas entre reintentos cuando el servidor rechaza el handshake (p. ej. token vencido). */
export const AUTH_RETRY_DELAYS_MS = [0, 2_000, 10_000, 30_000] as const;

export interface RealtimeClientOptions {
  url: string;
  path?: string;
  role: Role;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
  socketFactory?: SocketFactory;
  scheduler?: Scheduler;
  onInvalidPayload?: (payload: unknown) => void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const scheduler = options.scheduler ?? defaultScheduler;
  const schema = options.role === 'ADMIN' ? alertAdminSchema : alertResidenteSchema;
  const statusListeners = new Set<(status: RealtimeStatus) => void>();
  const alertListeners = new Set<(alert: AlertResidente) => void>();

  let status: RealtimeStatus = 'idle';
  let socket: SocketLike | null = null;
  let started = false;
  let authFailures = 0;
  let retryTimer: unknown = null;

  function setStatus(next: RealtimeStatus) {
    if (next === status) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  }

  function clearRetry() {
    if (retryTimer !== null) scheduler.clearTimeout(retryTimer);
    retryTimer = null;
  }

  const handleConnect: SocketListener = () => {
    authFailures = 0;
    setStatus('connected');
  };

  const handleDisconnect: SocketListener = (reason) => {
    if (!started || reason === 'io client disconnect') return; // desconexión pedida por nosotros
    setStatus(socket?.active ? 'reconnecting' : 'disconnected');
  };

  const handleConnectError: SocketListener = () => {
    if (!started || !socket) return;
    if (socket.active) {
      setStatus('reconnecting'); // error de transporte: socket.io reintenta solo
      return;
    }
    scheduleAuthRetry(); // rechazo del servidor: no hay reintento automático
  };

  const handleAlert: SocketListener = (payload) => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      options.onInvalidPayload?.(payload);
      return;
    }
    for (const listener of [...alertListeners]) listener(parsed.data);
  };

  function scheduleAuthRetry() {
    const delay = AUTH_RETRY_DELAYS_MS[authFailures];
    if (delay === undefined) {
      setStatus('disconnected');
      return;
    }
    authFailures += 1;
    setStatus('reconnecting');
    clearRetry();
    retryTimer = scheduler.setTimeout(() => {
      retryTimer = null;
      void options
        .refreshAccessToken()
        .catch(() => false)
        .then((renewed) => {
          if (!started || !socket) return;
          if (renewed || options.getAccessToken()) socket.connect();
          else setStatus('disconnected');
        });
    }, delay);
  }

  function ensureSocket(): SocketLike {
    if (socket) return socket;
    const created = (options.socketFactory ?? ioSocketFactory)({
      url: options.url,
      path: options.path ?? '/socket.io',
      getToken: options.getAccessToken,
    });
    created.on('connect', handleConnect);
    created.on('disconnect', handleDisconnect);
    created.on('connect_error', handleConnectError);
    created.on(ALERT_EVENT, handleAlert);
    socket = created;
    return created;
  }

  return {
    start() {
      if (started) return;
      started = true;
      if (!options.getAccessToken()) {
        setStatus('disconnected');
        return;
      }
      setStatus('connecting');
      ensureSocket().connect();
    },

    stop() {
      started = false;
      clearRetry();
      authFailures = 0;
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off(ALERT_EVENT, handleAlert);
        socket.disconnect();
        socket = null;
      }
      setStatus('idle');
    },

    tokenChanged() {
      if (!started || !options.getAccessToken()) return;
      clearRetry();
      authFailures = 0;
      const current = ensureSocket();
      // El token solo viaja en el handshake: hay que reconectar para que el servidor vea el nuevo.
      current.disconnect();
      if (status !== 'connected') setStatus('connecting');
      current.connect();
    },

    getStatus: () => status,

    onStatus(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },

    onAlert(listener) {
      alertListeners.add(listener);
      return () => {
        alertListeners.delete(listener);
      };
    },
  };
}
```

`packages/realtime/src/idle.ts`:
```ts
import type { RealtimeClient } from './client';

/** Cliente sin tiempo real (configuración sin URL de socket): siempre 'idle'. */
export function createIdleRealtimeClient(): RealtimeClient {
  return {
    start() {},
    stop() {},
    tokenChanged() {},
    getStatus: () => 'idle',
    onStatus: () => () => {},
    onAlert: () => () => {},
  };
}
```

`packages/realtime/src/index.ts`:
```ts
export * from './socket';
export * from './client';
export * from './idle';
```

Nota sobre `tokenChanged`: mientras el socket estaba conectado, el estado se mantiene en `connected` durante la reconexión (no se emite `connecting` ni `disconnected`), así la UI no parpadea cada ~13 min (Review Focus #3).

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/realtime test; pnpm --filter @gd/realtime typecheck; pnpm lint`
Expected: PASS, salida limpia. Si los tipos de `socket.io-client` rechazan `socket.on(event: string, …)` o la firma de `auth`, ajustar solo el adaptador de `ioSocketFactory` (sin `any`).

- [ ] **Step 6: Commit**

```
git add packages/realtime pnpm-lock.yaml
git commit -m "feat(realtime): cliente Socket.IO con reconexión por token y validación por rol"
```

---

### Task 4: Backend simulado — acuse, emisor de alertas y tiempo real simulado

**Files:**
- Create: `apps/web/src/mocks/serialize.ts`, `apps/web/src/mocks/realtimeBus.ts`, `apps/web/src/mocks/emit.ts`, `apps/web/src/mocks/realtime.ts`
- Create: `apps/web/src/mocks/DevPanel.tsx`, `apps/web/src/mocks/DevPanel.module.css`
- Modify: `apps/web/src/mocks/handlers/alerts.ts`, `apps/web/src/mocks/db.ts`, `apps/web/src/mocks/browser.ts`, `apps/web/src/test/setup.ts`
- Modify: `apps/web/package.json` (dependencia `@gd/realtime`)
- Test: `apps/web/src/mocks/realtime.test.ts`

**Interfaces:**
- Consumes: `RealtimeClient`, `RealtimeStatus` (`@gd/realtime`); `AlertAdmin`, `AlertResidente`, `Role` (`@gd/api`); `db`, `authenticate`, `requireRole`, `errorResponse`, `BUILDING_ID`.
- Produces:
  - `toResidenteAlert(alert: AlertAdmin): AlertResidente` (`mocks/serialize.ts`)
  - `realtimeBus` con `publishAlert(alert: AlertAdmin)`, `setStatus(status)`, `getStatus()`, `subscribeAlerts(l): () => void`, `subscribeStatus(l): () => void`, `reset()`
  - `emitMockAlert(input: { level: 'CRITICAL' | 'WARNING'; sensorId?: string; message?: string }): AlertAdmin` — deduplica por sensor+nivel abiertos (sube `occurrence_count`, mismo `alert_id`) y publica.
  - `createMockRealtimeClient(role: Role): RealtimeClient`
  - `POST */api/v1/alerts/:id/ack` (ADMIN; 403 residente; 404 si no existe; `db.settings.failNextAck` → 500 una vez)
  - `window.__gdMocks` gana `emitAlert(level): string` (devuelve `alert_id`), `setRealtimeStatus(status)`, `failNextAck()`
  - `DevPanel` (solo modo mock con `?dev=1`) e `isDevPanelRequested(): boolean`

- [ ] **Step 1: Añadir la dependencia**

Run: `pnpm --filter @gd/web add @gd/realtime@workspace:*`

- [ ] **Step 2: Escribir el test que falla**

`apps/web/src/mocks/realtime.test.ts`:
```ts
import { ApiError, MemoryTokenStore, createApi, createHttpClient, createSessionManager, type AlertAdmin } from '@gd/api';
import { describe, expect, it, vi } from 'vitest';
import { db, resetDb } from './db';
import { emitMockAlert } from './emit';
import { createMockRealtimeClient } from './realtime';
import { realtimeBus } from './realtimeBus';
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

function criticalId(): string {
  const found = db.alerts.find((a) => a.level === 'CRITICAL');
  if (!found) throw new Error('el escenario no tiene alerta crítica');
  return found.alert_id;
}

describe('acuse simulado', () => {
  it('el administrador marca la alerta como revisada', async () => {
    resetDb('critico');
    const api = await apiAs(ADMIN_EMAIL);
    const updated = await api.alerts.ack(criticalId());
    expect(updated.acknowledged).toBe(true);
    expect(updated.acknowledged_by).toBe('Administración Demo');
    expect(updated.acknowledged_at).not.toBeNull();
  });

  it('el residente recibe 403', async () => {
    resetDb('critico');
    const api = await apiAs(RESIDENTE_EMAIL);
    await expect(api.alerts.ack(criticalId())).rejects.toMatchObject({ status: 403 });
  });

  it('una alerta inexistente da 404', async () => {
    const api = await apiAs(ADMIN_EMAIL);
    await expect(api.alerts.ack('alrt-00000000-99999')).rejects.toMatchObject({ status: 404 });
  });

  it('failNextAck falla una sola vez', async () => {
    resetDb('critico');
    const api = await apiAs(ADMIN_EMAIL);
    db.settings.failNextAck = true;
    const err = await api.alerts.ack(criticalId()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500 });
    await expect(api.alerts.ack(criticalId())).resolves.toMatchObject({ acknowledged: true });
  });
});

describe('emisor de alertas', () => {
  it('crea una alerta con el siguiente id y la publica', () => {
    resetDb('sano');
    const received = vi.fn();
    realtimeBus.subscribeAlerts(received);
    const alert = emitMockAlert({ level: 'CRITICAL' });
    expect(alert.alert_id).toMatch(/^alrt-\d{8}-00004$/);
    expect(db.alerts).toContainEqual(expect.objectContaining({ alert_id: alert.alert_id }));
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ alert_id: alert.alert_id, level: 'CRITICAL' }));
  });

  it('una nueva ocurrencia reutiliza el id y sube occurrence_count', () => {
    resetDb('sano');
    const first = emitMockAlert({ level: 'WARNING' });
    const second = emitMockAlert({ level: 'WARNING' });
    expect(second.alert_id).toBe(first.alert_id);
    expect(second.occurrence_count).toBe(2);
    expect(db.alerts.filter((a) => a.alert_id === first.alert_id)).toHaveLength(1);
  });
});

describe('cliente de tiempo real simulado', () => {
  it('sigue el estado del bus y entrega la forma del rol', () => {
    const admin = createMockRealtimeClient('ADMIN');
    const residente = createMockRealtimeClient('RESIDENTE');
    const adminAlerts: AlertAdmin[] = [];
    const residenteAlerts: unknown[] = [];
    admin.onAlert((a) => adminAlerts.push(a as AlertAdmin));
    residente.onAlert((a) => residenteAlerts.push(a));
    admin.start();
    residente.start();
    expect(admin.getStatus()).toBe('connected');

    emitMockAlert({ level: 'CRITICAL' });
    expect(adminAlerts[0]?.value_triggered).toBe(0.41);
    expect(residenteAlerts[0]).not.toHaveProperty('value_triggered');

    realtimeBus.setStatus('disconnected');
    expect(admin.getStatus()).toBe('disconnected');

    admin.stop();
    emitMockAlert({ level: 'WARNING' });
    expect(adminAlerts).toHaveLength(1);
    expect(admin.getStatus()).toBe('idle');
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelven `./emit`, `./realtime`, `./realtimeBus`.

- [ ] **Step 4: Implementar**

`apps/web/src/mocks/serialize.ts`:
```ts
import type { AlertAdmin, AlertResidente } from '@gd/api';

/** Lista blanca: el residente nunca recibe valores numéricos ni datos de acuse. */
export function toResidenteAlert(alert: AlertAdmin): AlertResidente {
  const { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged } = alert;
  return { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged };
}
```

En `apps/web/src/mocks/handlers/alerts.ts`: borrar la función local `toResidente`, importar `toResidenteAlert` desde `../serialize`, usarla en el `GET`, y añadir el handler de acuse (y los imports de `requireRole`, `errorResponse`):
```ts
import type { AlertAdmin } from '@gd/api';
import { HttpResponse, http } from 'msw';
import { authenticate, errorResponse, requireRole } from '../auth';
import { db } from '../db';
import { toResidenteAlert } from '../serialize';

export const alertHandlers = [
  http.get('*/api/v1/alerts', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const params = new URL(request.url).searchParams;
    const level = params.get('level');
    const acknowledged = params.get('acknowledged');
    let list = [...db.alerts];
    if (level) list = list.filter((a) => a.level === level);
    if (acknowledged === 'true' || acknowledged === 'false') {
      list = list.filter((a) => a.acknowledged === (acknowledged === 'true'));
    }
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const data = auth.role === 'ADMIN' ? list : list.map(toResidenteAlert);
    return HttpResponse.json({ count: data.length, data });
  }),

  http.post('*/api/v1/alerts/:id/ack', ({ request, params }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    if (db.settings.failNextAck) {
      db.settings.failNextAck = false;
      return errorResponse(500, 'SIMULATED_FAILURE', 'Falla simulada del servidor');
    }
    const alert: AlertAdmin | undefined = db.alerts.find((a) => a.alert_id === String(params.id));
    if (!alert) return errorResponse(404, 'NOT_FOUND', 'Alerta no encontrada');
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledged_by = db.users.find((u) => u.id === auth.sub)?.name ?? auth.sub;
      alert.acknowledged_at = new Date().toISOString();
    }
    return HttpResponse.json(alert);
  }),
];
```

En `apps/web/src/mocks/db.ts`: añadir `failNextAck: boolean` a `MockDb['settings']` y `failNextAck: false` al objeto `settings` de `createDb`:
```ts
  settings: {
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    /** Tokens emitidos antes de este instante (ms) se rechazan. */
    accessValidAfterMs: number;
    refreshValidAfterMs: number;
    /** El próximo POST /alerts/:id/ack responde 500 (para probar la reversión). */
    failNextAck: boolean;
  };
```
```ts
    settings: {
      accessTtlSeconds: 900,
      refreshTtlSeconds: 7 * 24 * 3600,
      accessValidAfterMs: 0,
      refreshValidAfterMs: 0,
      failNextAck: false,
    },
```

`apps/web/src/mocks/realtimeBus.ts`:
```ts
import type { AlertAdmin } from '@gd/api';
import type { RealtimeStatus } from '@gd/realtime';

type AlertListener = (alert: AlertAdmin) => void;
type StatusListener = (status: RealtimeStatus) => void;

const alertListeners = new Set<AlertListener>();
const statusListeners = new Set<StatusListener>();
let status: RealtimeStatus = 'connected';

/** "Servidor" de tiempo real simulado: los clientes simulados se suscriben aquí. */
export const realtimeBus = {
  publishAlert(alert: AlertAdmin) {
    for (const listener of [...alertListeners]) listener(alert);
  },
  setStatus(next: RealtimeStatus) {
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  },
  getStatus: (): RealtimeStatus => status,
  subscribeAlerts(listener: AlertListener): () => void {
    alertListeners.add(listener);
    return () => {
      alertListeners.delete(listener);
    };
  },
  subscribeStatus(listener: StatusListener): () => void {
    statusListeners.add(listener);
    return () => {
      statusListeners.delete(listener);
    };
  },
  reset() {
    status = 'connected';
    alertListeners.clear();
    statusListeners.clear();
  },
};
```

`apps/web/src/mocks/emit.ts`:
```ts
import type { AlertAdmin } from '@gd/api';
import { db } from './db';
import { realtimeBus } from './realtimeBus';
import { BUILDING_ID } from './seed';

const DEFAULTS = {
  CRITICAL: { sensorId: 'acc-t1-sotano', message: 'Aceleración superior al umbral configurado', value: 0.41, threshold: 0.2 },
  WARNING: { sensorId: 'crack-t2-cubierta', message: 'Cambio medido en la apertura de fisura', value: 0.95, threshold: 0.8 },
} as const;

export interface MockAlertInput {
  /** El backend solo emite CRITICAL y WARNING por socket (INFO va por polling). */
  level: 'CRITICAL' | 'WARNING';
  sensorId?: string;
  message?: string;
}

function nextAlertId(now: number): string {
  const seq = db.alerts.reduce((max, a) => Math.max(max, Number(a.alert_id.slice(-5)) || 0), 0) + 1;
  const ymd = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  return `alrt-${ymd}-${String(seq).padStart(5, '0')}`;
}

/** Simula una alerta del backend: deduplica por sensor+nivel abiertos y la publica por "socket". */
export function emitMockAlert(input: MockAlertInput): AlertAdmin {
  const defaults = DEFAULTS[input.level];
  const sensorId = input.sensorId ?? defaults.sensorId;
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const open = db.alerts.find((a) => a.sensor_id === sensorId && a.level === input.level && !a.acknowledged);

  let alert: AlertAdmin;
  if (open) {
    open.occurrence_count += 1;
    open.timestamp = timestamp;
    open.value_triggered = defaults.value;
    alert = open;
  } else {
    alert = {
      alert_id: nextAlertId(now),
      building_id: BUILDING_ID,
      sensor_id: sensorId,
      level: input.level,
      category: db.sensors.find((s) => s.sensor_id === sensorId)?.category ?? 'structural',
      message: input.message ?? defaults.message,
      timestamp,
      acknowledged: false,
      value_triggered: defaults.value,
      threshold_configured: defaults.threshold,
      occurrence_count: 1,
      acknowledged_by: null,
      acknowledged_at: null,
    };
    db.alerts.push(alert);
  }
  realtimeBus.publishAlert({ ...alert });
  return alert;
}
```

`apps/web/src/mocks/realtime.ts`:
```ts
import type { AlertResidente, Role } from '@gd/api';
import type { RealtimeClient, RealtimeStatus } from '@gd/realtime';
import { realtimeBus } from './realtimeBus';
import { toResidenteAlert } from './serialize';

/** Implementación de RealtimeClient alimentada por el bus del backend simulado. */
export function createMockRealtimeClient(role: Role): RealtimeClient {
  const statusListeners = new Set<(status: RealtimeStatus) => void>();
  const alertListeners = new Set<(alert: AlertResidente) => void>();
  let status: RealtimeStatus = 'idle';
  let unsubscribe: (() => void) | null = null;

  function setStatus(next: RealtimeStatus) {
    if (next === status) return;
    status = next;
    for (const listener of [...statusListeners]) listener(next);
  }

  return {
    start() {
      if (unsubscribe) return;
      const offAlerts = realtimeBus.subscribeAlerts((alert) => {
        const shaped = role === 'ADMIN' ? { ...alert } : toResidenteAlert(alert);
        for (const listener of [...alertListeners]) listener(shaped);
      });
      const offStatus = realtimeBus.subscribeStatus(setStatus);
      unsubscribe = () => {
        offAlerts();
        offStatus();
      };
      setStatus(realtimeBus.getStatus());
    },
    stop() {
      unsubscribe?.();
      unsubscribe = null;
      setStatus('idle');
    },
    tokenChanged() {},
    getStatus: () => status,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    onAlert(listener) {
      alertListeners.add(listener);
      return () => {
        alertListeners.delete(listener);
      };
    },
  };
}
```

En `apps/web/src/mocks/browser.ts`: ampliar la declaración global y el objeto `__gdMocks`:
```ts
import type { RealtimeStatus } from '@gd/realtime';
import { setupWorker } from 'msw/browser';
import { db, resetDb } from './db';
import { emitMockAlert } from './emit';
import { handlers } from './handlers';
import { realtimeBus } from './realtimeBus';
import { isScenario, type Scenario } from './seed';

declare global {
  interface Window {
    __gdMocks?: {
      expireAccessTokens(): void;
      revokeRefreshTokens(): void;
      reset(scenario?: Scenario): void;
      /** Simula un `alert:new` del servidor; devuelve el `alert_id`. */
      emitAlert(level: 'CRITICAL' | 'WARNING'): string;
      setRealtimeStatus(status: RealtimeStatus): void;
      failNextAck(): void;
    };
  }
}
```
y en `startMockWorker`:
```ts
  window.__gdMocks = {
    expireAccessTokens: () => {
      db.settings.accessValidAfterMs = Date.now() + 1;
    },
    revokeRefreshTokens: () => {
      db.settings.refreshValidAfterMs = Date.now() + 1;
    },
    reset: (scenario) => resetDb(scenario),
    emitAlert: (level) => emitMockAlert({ level }).alert_id,
    setRealtimeStatus: (status) => realtimeBus.setStatus(status),
    failNextAck: () => {
      db.settings.failNextAck = true;
    },
  };
```
(el resto de `browser.ts` queda igual).

`apps/web/src/mocks/DevPanel.module.css`:
```css
.panel {
  position: fixed;
  left: var(--space-4);
  bottom: var(--space-4);
  z-index: 200;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  font-size: 0.875rem;
}
.panel button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
```

`apps/web/src/mocks/DevPanel.tsx`:
```tsx
import { useState } from 'react';
import styles from './DevPanel.module.css';
import { emitMockAlert } from './emit';
import { realtimeBus } from './realtimeBus';

const DEV_KEY = 'gd.mock.dev';

/** `?dev=1` activa el panel y se recuerda en la pestaña. */
export function isDevPanelRequested(): boolean {
  const fromUrl = new URLSearchParams(window.location.search).get('dev') === '1';
  try {
    if (fromUrl) window.sessionStorage.setItem(DEV_KEY, '1');
    return fromUrl || window.sessionStorage.getItem(DEV_KEY) === '1';
  } catch {
    return fromUrl;
  }
}

export function DevPanel() {
  const [connected, setConnected] = useState(realtimeBus.getStatus() === 'connected');
  return (
    <aside className={styles.panel} aria-label="Panel de simulación">
      <strong>Simulación (solo desarrollo)</strong>
      <button type="button" onClick={() => emitMockAlert({ level: 'CRITICAL' })}>
        Simular alerta crítica
      </button>
      <button type="button" onClick={() => emitMockAlert({ level: 'WARNING' })}>
        Simular advertencia
      </button>
      <button
        type="button"
        onClick={() => {
          realtimeBus.setStatus(connected ? 'disconnected' : 'connected');
          setConnected(!connected);
        }}
      >
        {connected ? 'Cortar tiempo real' : 'Restablecer tiempo real'}
      </button>
    </aside>
  );
}
```

En `apps/web/src/test/setup.ts`, añadir el import y el reset del bus en `afterEach`:
```ts
import { realtimeBus } from '../mocks/realtimeBus';
```
```ts
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  realtimeBus.reset();
  window.sessionStorage.clear();
});
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (los tests existentes de mocks siguen en verde).

- [ ] **Step 6: Commit**

```
git add apps/web pnpm-lock.yaml
git commit -m "feat(mocks): acuse de alertas, emisor y tiempo real simulados"
```

---

### Task 5: Notificaciones (toasts)

**Files:**
- Create: `apps/web/src/ui/toast/ToastProvider.tsx`, `apps/web/src/ui/toast/Toast.module.css`
- Test: `apps/web/src/ui/toast/ToastProvider.test.tsx`

**Interfaces:**
- Consumes: `STATUS_META` (Plan 1).
- Produces:
  - `type ToastTone = 'CRITICAL' | 'WARNING'`
  - `interface ToastInput { id: string; tone: ToastTone; title: string; message: string; href?: string; actionLabel?: string }`
  - `WARNING_TOAST_MS = 8_000`; `MAX_TOASTS = 4`; `capToasts(list: ToastInput[], max?: number): ToastInput[]` (descarta primero las advertencias más antiguas)
  - `ToastProvider({ children })`; `useToasts(): { toasts: ToastInput[]; show(t: ToastInput): void; dismiss(id: string): void }` (`show` y `dismiss` estables)
  - `ToastViewport()` — `<section aria-label="Notificaciones">` con `<div role="alert">` (críticas) y `<div role="status">` (advertencias) siempre montados; requiere estar dentro de un Router.
- Reglas: mismo `id` → reemplaza y pasa arriba (no duplica); CRITICAL persiste; WARNING se cierra a los 8 s; el enlace de acción cierra el toast.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/src/ui/toast/ToastProvider.test.tsx`:
```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, ToastViewport, WARNING_TOAST_MS, capToasts, useToasts, type ToastInput } from './ToastProvider';

const critical = (id: string, message = 'Aceleración superior al umbral configurado'): ToastInput => ({
  id,
  tone: 'CRITICAL',
  title: 'Alerta crítica',
  message,
  href: `/alertas?alerta=${id}`,
  actionLabel: 'Ver alerta',
});
const warning = (id: string): ToastInput => ({ id, tone: 'WARNING', title: 'Advertencia', message: `Aviso ${id}` });

let api: ReturnType<typeof useToasts> | null = null;
function Capture() {
  api = useToasts();
  return null;
}

function renderToasts() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/']}>
        <Capture />
        <ToastViewport />
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/alertas" element={<p>Página de alertas</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  return {
    show: (t: ToastInput) => act(() => api?.show(t)),
    criticalRegion: () => within(screen.getByRole('region', { name: 'Notificaciones' })).getByRole('alert'),
    warningRegion: () => within(screen.getByRole('region', { name: 'Notificaciones' })).getByRole('status'),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  api = null;
});

describe('toasts', () => {
  it('una crítica persiste y se anuncia en la región role="alert"', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1'));
    act(() => vi.advanceTimersByTime(60_000));
    expect(criticalRegion()).toHaveTextContent('Aceleración superior al umbral configurado');
  });

  it('una advertencia va a role="status" y se cierra sola a los 8 s', () => {
    const { show, warningRegion } = renderToasts();
    show(warning('w1'));
    expect(warningRegion()).toHaveTextContent('Aviso w1');
    act(() => vi.advanceTimersByTime(WARNING_TOAST_MS + 1));
    expect(warningRegion()).toBeEmptyDOMElement();
  });

  it('el mismo id reemplaza el toast en vez de duplicarlo', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1', 'primera'));
    show(critical('a1', 'segunda'));
    expect(within(criticalRegion()).getAllByText(/primera|segunda/)).toHaveLength(1);
    expect(criticalRegion()).toHaveTextContent('segunda');
  });

  it('el botón cerrar lo quita', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1'));
    fireEvent.click(within(criticalRegion()).getByRole('button', { name: 'Cerrar notificación' }));
    expect(criticalRegion()).toBeEmptyDOMElement();
  });

  it('el enlace navega y cierra el toast', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1'));
    fireEvent.click(within(criticalRegion()).getByRole('link', { name: 'Ver alerta' }));
    expect(screen.getByText('Página de alertas')).toBeInTheDocument();
    expect(criticalRegion()).toBeEmptyDOMElement();
  });
});

describe('capToasts', () => {
  it('descarta primero la advertencia más antigua', () => {
    const list = [critical('c3'), warning('w2'), critical('c1'), warning('w1')];
    expect(capToasts([critical('c4'), ...list], 4).map((t) => t.id)).toEqual(['c4', 'c3', 'w2', 'c1']);
  });
  it('si no hay advertencias, descarta la crítica más antigua', () => {
    expect(capToasts([critical('c3'), critical('c2'), critical('c1')], 2).map((t) => t.id)).toEqual(['c3', 'c2']);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelve `./ToastProvider`.

- [ ] **Step 3: Implementar**

`apps/web/src/ui/toast/Toast.module.css`:
```css
.viewport {
  position: fixed;
  top: calc(56px + var(--space-3));
  right: var(--space-4);
  z-index: 150;
  width: min(380px, calc(100vw - 2 * var(--space-4)));
  display: grid;
  gap: var(--space-2);
  pointer-events: none;
}
.viewport > div {
  display: grid;
  gap: var(--space-2);
}
.toast {
  pointer-events: auto;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-left-width: 6px;
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
}
.toast[data-tone='CRITICAL'] { border-left-color: var(--status-critical-fg); }
.toast[data-tone='CRITICAL'] > svg { color: var(--status-critical-fg); }
.toast[data-tone='WARNING'] { border-left-color: var(--status-warning-fg); }
.toast[data-tone='WARNING'] > svg { color: var(--status-warning-fg); }
.title { margin: 0; font-weight: 700; }
.message { margin: var(--space-1) 0 0; }
.action {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-weight: 600;
  color: var(--accent);
}
.close {
  min-width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
@media (max-width: 767px) {
  .viewport { top: auto; bottom: calc(72px + var(--space-3)); right: var(--space-4); left: var(--space-4); width: auto; }
}
```

`apps/web/src/ui/toast/ToastProvider.tsx`:
```tsx
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { STATUS_META } from '../statusMeta';
import styles from './Toast.module.css';

export type ToastTone = 'CRITICAL' | 'WARNING';

export interface ToastInput {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
}

export const WARNING_TOAST_MS = 8_000;
export const MAX_TOASTS = 4;

interface ToastContextValue {
  toasts: ToastInput[];
  show(toast: ToastInput): void;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Limita la pila descartando primero las advertencias más antiguas. */
export function capToasts(list: ToastInput[], max: number = MAX_TOASTS): ToastInput[] {
  const result = [...list];
  while (result.length > max) {
    const oldestWarning = result.findLastIndex((t) => t.tone === 'WARNING');
    result.splice(oldestWarning === -1 ? result.length - 1 : oldestWarning, 1);
  }
  return result;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastInput[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const previous = timersRef.current.get(toast.id);
      if (previous) {
        clearTimeout(previous);
        timersRef.current.delete(toast.id);
      }
      if (toast.tone === 'WARNING') {
        timersRef.current.set(
          toast.id,
          setTimeout(() => dismiss(toast.id), WARNING_TOAST_MS),
        );
      }
      setToasts((prev) => capToasts([toast, ...prev.filter((t) => t.id !== toast.id)]));
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToasts debe usarse dentro de <ToastProvider>');
  return value;
}

function ToastCard({ toast, onDismiss }: { toast: ToastInput; onDismiss: (id: string) => void }) {
  const { Icon } = STATUS_META[toast.tone];
  return (
    <div className={styles.toast} data-tone={toast.tone}>
      <Icon aria-hidden="true" size={22} />
      <div>
        <p className={styles.title}>{toast.title}</p>
        <p className={styles.message}>{toast.message}</p>
        {toast.href && (
          <Link to={toast.href} className={styles.action} onClick={() => onDismiss(toast.id)}>
            {toast.actionLabel ?? 'Ver'}
          </Link>
        )}
      </div>
      <button type="button" className={styles.close} aria-label="Cerrar notificación" onClick={() => onDismiss(toast.id)}>
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

/** Las dos regiones vivas están siempre montadas para que los lectores de pantalla anuncien lo nuevo. */
export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  return (
    <section className={styles.viewport} aria-label="Notificaciones">
      <div role="alert">
        {toasts
          .filter((t) => t.tone === 'CRITICAL')
          .map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
      </div>
      <div role="status">
        {toasts
          .filter((t) => t.tone === 'WARNING')
          .map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS, salida limpia.

- [ ] **Step 5: Commit**

```
git add apps/web/src/ui/toast
git commit -m "feat(web): notificaciones con regiones vivas y cierre automático de advertencias"
```

---

### Task 6: Sonido de alerta crítica y aviso en el título de la pestaña

**Files:**
- Create: `apps/web/src/features/realtime/alertSound.ts`, `apps/web/src/features/realtime/alertSound.test.ts`
- Create: `apps/web/src/features/realtime/titleBadge.ts`, `apps/web/src/features/realtime/titleBadge.test.tsx`

**Interfaces:**
- Consumes: `AlertLevel` (`@gd/domain`).
- Produces:
  - `type SoundResult = 'played' | 'blocked' | 'unsupported'`
  - `interface AlertSound { play(): Promise<SoundResult>; unlock(): Promise<boolean> }`
  - `createAlertSound(getContextCtor?: () => (new () => AudioContext) | undefined): AlertSound` — tono generado con Web Audio (sin archivos); nunca lanza.
  - `BASE_TITLE = 'Gemelo Digital'`; `badgeTitle(base: string, count: number, hasCritical: boolean): string`
  - `useTitleBadge(): (level: AlertLevel) => void` — solo cuenta con la pestaña oculta; al volver a ser visible restaura el título.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/features/realtime/alertSound.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createAlertSound } from './alertSound';

class FakeAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  value = 0;
}
class FakeNode {
  frequency = new FakeAudioParam();
  gain = new FakeAudioParam();
  type = 'sine';
  connect = vi.fn((target: unknown) => target);
  start = vi.fn();
  stop = vi.fn();
}

function fakeContextCtor(initialState: AudioContextState, resumeWorks: boolean) {
  const created: FakeContext[] = [];
  class FakeContext {
    state: AudioContextState = initialState;
    currentTime = 0;
    destination = {};
    oscillators: FakeNode[] = [];
    constructor() {
      created.push(this);
    }
    resume = vi.fn(async () => {
      if (!resumeWorks) throw new Error('NotAllowedError');
      this.state = 'running';
    });
    createOscillator() {
      const node = new FakeNode();
      this.oscillators.push(node);
      return node;
    }
    createGain() {
      return new FakeNode();
    }
  }
  return { Ctor: FakeContext as unknown as new () => AudioContext, created };
}

describe('createAlertSound', () => {
  it('suena si el contexto de audio está activo', async () => {
    const { Ctor, created } = fakeContextCtor('running', true);
    const sound = createAlertSound(() => Ctor);
    await expect(sound.play()).resolves.toBe('played');
    expect(created[0]?.oscillators.length).toBeGreaterThan(0);
  });

  it('informa "blocked" sin lanzar si el navegador bloquea el audio', async () => {
    const { Ctor } = fakeContextCtor('suspended', false);
    const sound = createAlertSound(() => Ctor);
    await expect(sound.play()).resolves.toBe('blocked');
    await expect(sound.unlock()).resolves.toBe(false);
  });

  it('unlock reactiva el audio tras un gesto del usuario', async () => {
    const { Ctor } = fakeContextCtor('suspended', true);
    const sound = createAlertSound(() => Ctor);
    await expect(sound.unlock()).resolves.toBe(true);
    await expect(sound.play()).resolves.toBe('played');
  });

  it('sin Web Audio responde "unsupported"', async () => {
    const sound = createAlertSound(() => undefined);
    await expect(sound.play()).resolves.toBe('unsupported');
    await expect(sound.unlock()).resolves.toBe(false);
  });
});
```

`apps/web/src/features/realtime/titleBadge.test.tsx`:
```tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BASE_TITLE, badgeTitle, useTitleBadge } from './titleBadge';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  setVisibility('visible');
  document.title = BASE_TITLE;
});

describe('badgeTitle', () => {
  it('sin pendientes deja el título base', () => {
    expect(badgeTitle('Gemelo Digital', 0, false)).toBe('Gemelo Digital');
  });
  it('indica cuántas llegaron y si hay críticas', () => {
    expect(badgeTitle('Gemelo Digital', 2, true)).toBe('(2) ⚠ Alerta crítica · Gemelo Digital');
    expect(badgeTitle('Gemelo Digital', 1, false)).toBe('(1) ⚠ Nueva alerta · Gemelo Digital');
  });
});

describe('useTitleBadge', () => {
  it('con la pestaña visible no toca el título', () => {
    document.title = BASE_TITLE;
    const { result } = renderHook(() => useTitleBadge());
    act(() => result.current('CRITICAL'));
    expect(document.title).toBe(BASE_TITLE);
  });

  it('con la pestaña oculta acumula y al volver restaura', () => {
    document.title = BASE_TITLE;
    const { result } = renderHook(() => useTitleBadge());
    act(() => setVisibility('hidden'));
    act(() => result.current('WARNING'));
    act(() => result.current('CRITICAL'));
    expect(document.title).toBe('(2) ⚠ Alerta crítica · Gemelo Digital');
    act(() => setVisibility('visible'));
    expect(document.title).toBe(BASE_TITLE);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelven `./alertSound` ni `./titleBadge`.

- [ ] **Step 3: Implementar**

`apps/web/src/features/realtime/alertSound.ts`:
```ts
export type SoundResult = 'played' | 'blocked' | 'unsupported';

export interface AlertSound {
  play(): Promise<SoundResult>;
  /** Llamar desde un gesto del usuario (clic) para desbloquear el audio. */
  unlock(): Promise<boolean>;
}

type AudioContextCtor = new () => AudioContext;

function defaultCtor(): AudioContextCtor | undefined {
  return typeof window === 'undefined' ? undefined : window.AudioContext;
}

/** Dos tonos cortos generados con Web Audio: no requiere archivos y nunca lanza. */
export function createAlertSound(getContextCtor: () => AudioContextCtor | undefined = defaultCtor): AlertSound {
  let context: AudioContext | null = null;

  function getContext(): AudioContext | null {
    if (context) return context;
    const Ctor = getContextCtor();
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    return context;
  }

  async function resume(ctx: AudioContext): Promise<boolean> {
    if (ctx.state === 'running') return true;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
    return ctx.state === 'running';
  }

  function beep(ctx: AudioContext) {
    const start = ctx.currentTime;
    const tones: [number, number][] = [
      [0, 880],
      [0.25, 660],
    ];
    for (const [offset, frequency] of tones) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.22);
    }
  }

  return {
    async play() {
      const ctx = getContext();
      if (!ctx) return 'unsupported';
      if (!(await resume(ctx))) return 'blocked';
      try {
        beep(ctx);
      } catch {
        return 'blocked';
      }
      return 'played';
    },
    async unlock() {
      const ctx = getContext();
      if (!ctx) return false;
      return resume(ctx);
    },
  };
}
```

`apps/web/src/features/realtime/titleBadge.ts`:
```ts
import type { AlertLevel } from '@gd/domain';
import { useCallback, useEffect, useRef } from 'react';

export const BASE_TITLE = 'Gemelo Digital';

export function badgeTitle(base: string, count: number, hasCritical: boolean): string {
  if (count <= 0) return base;
  return `(${count}) ⚠ ${hasCritical ? 'Alerta crítica' : 'Nueva alerta'} · ${base}`;
}

/** Marca el título de la pestaña cuando llegan alertas con la pestaña oculta. */
export function useTitleBadge(): (level: AlertLevel) => void {
  const pending = useRef({ count: 0, critical: false });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      pending.current = { count: 0, critical: false };
      document.title = BASE_TITLE;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return useCallback((level: AlertLevel) => {
    if (document.visibilityState !== 'hidden') return;
    pending.current = {
      count: pending.current.count + 1,
      critical: pending.current.critical || level === 'CRITICAL',
    };
    document.title = badgeTitle(BASE_TITLE, pending.current.count, pending.current.critical);
  }, []);
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add apps/web/src/features/realtime
git commit -m "feat(web): sonido de alerta crítica y aviso en el título de la pestaña"
```

---

### Task 7: `RealtimeProvider` — sesión, caché, toasts y sonido

**Files:**
- Create: `apps/web/src/features/realtime/RealtimeProvider.tsx`, `apps/web/src/features/realtime/alertToast.ts`
- Modify: `apps/web/src/app/services.ts`, `apps/web/src/app/AppProviders.tsx`, `apps/web/src/app/layout/AppShell.tsx`, `apps/web/src/app/config.ts`, `apps/web/src/vite-env.d.ts`, `apps/web/src/main.tsx`, `apps/web/src/test/renderApp.tsx`
- Test: `apps/web/src/features/realtime/RealtimeProvider.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–6; `useSession` (Plan 1).
- Produces:
  - `services.ts`: `interface RealtimeFactoryArgs { role: Role; getAccessToken(): string | null; refreshAccessToken(): Promise<boolean> }`, `type RealtimeFactory = (args: RealtimeFactoryArgs) => RealtimeClient`; `ServicesOptions` gana `realtimeUrl?: string` y `createRealtime?: RealtimeFactory`; `Services` gana `createRealtime(role: Role): RealtimeClient`. Por defecto: con `realtimeUrl` → `createRealtimeClient`; sin URL → `createIdleRealtimeClient`.
  - `mocks/realtime.ts` gana `mockRealtimeFactory: RealtimeFactory`.
  - `alertToast(alert: AlertResidente): ToastInput` (título "Alerta crítica"/"Advertencia", acción "Ver alerta" → `/alertas?alerta=<id>`).
  - `RealtimeProvider({ createRealtime, sound?, children })`; `useRealtime(): { status: RealtimeStatus; soundBlocked: boolean; enableSound(): Promise<void> }`.
  - `AppProviders({ services, sound?, children })` — orden: QueryClient → Api → Session → Toast → Realtime.
  - `AppShell` renderiza `<ToastViewport />`.
  - `config.realtimeUrl` (`VITE_REALTIME_URL` → `VITE_API_BASE_URL` → `window.location.origin`).
  - `test/renderApp.tsx`: `createTestServices(overrides?: Partial<ServicesOptions>)` usa `mockRealtimeFactory` por defecto; `renderApp(services, route?, options?: { sound?: AlertSound })`.
- Comportamiento: cliente por usuario+rol mientras la sesión está `authenticated` (se detiene en `expired`/`anonymous`); `tokenChanged()` cuando cambia el access token del mismo usuario; cada alerta → `applyAlertToCache` + invalidar `dashboard/general` y `sensors`; CRITICAL/WARNING → toast y título; CRITICAL → sonido (si queda bloqueado, `soundBlocked = true`); al volver a `connected` tras haber estado conectado → invalidar `alerts` y `dashboard/general`.

- [ ] **Step 1: Escribir el test que falla**

`apps/web/src/features/realtime/RealtimeProvider.test.tsx`:
```tsx
import type { AlertResidente } from '@gd/api';
import { queryKeys } from '@gd/query';
import type { RealtimeClient } from '@gd/realtime';
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { createMockRealtimeClient } from '../../mocks/realtime';
import { realtimeBus } from '../../mocks/realtimeBus';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';
import type { AlertSound } from './alertSound';

async function homeReady() {
  await screen.findByRole('region', { name: 'Salud del edificio' });
}

function toastRegion() {
  return screen.getByRole('region', { name: 'Notificaciones' });
}

describe('RealtimeProvider', () => {
  it('una alerta crítica por socket aparece al instante como notificación y en el banner del home', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });

    expect(within(toastRegion()).getByRole('alert')).toHaveTextContent('Aceleración superior al umbral configurado');
    expect(await screen.findByRole('region', { name: 'Alertas críticas sin revisar' })).toHaveTextContent(
      '1 alerta crítica sin revisar',
    );
  });

  it('una advertencia va a la región de estado y no hace sonar nada', async () => {
    const play = vi.fn(async () => 'played' as const);
    const sound: AlertSound = { play, unlock: async () => true };
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/', { sound });
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'WARNING' });
    });

    expect(within(toastRegion()).getByRole('status')).toHaveTextContent('Cambio medido en la apertura de fisura');
    expect(play).not.toHaveBeenCalled();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('al residente le llegan alertas sin números a la caché', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/');
    await homeReady();

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });

    const lists = services.queryClient.getQueriesData<{ data: AlertResidente[] }>({
      queryKey: [...queryKeys.alerts.all(), 'RESIDENTE'],
    });
    const alerts = lists.flatMap(([, list]) => list?.data ?? []);
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) expect(alert).not.toHaveProperty('value_triggered');
  });

  it('al rotar el token reconecta una sola vez y al cerrar sesión detiene el cliente', async () => {
    const clients: RealtimeClient[] = [];
    const services = createTestServices({
      createRealtime: ({ role }) => {
        const client = createMockRealtimeClient(role);
        vi.spyOn(client, 'tokenChanged');
        vi.spyOn(client, 'stop');
        clients.push(client);
        return client;
      },
    });
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();

    const active = clients.at(-1);
    if (!active) throw new Error('no se creó el cliente de tiempo real');
    expect(active.tokenChanged).not.toHaveBeenCalled();

    await act(async () => {
      await services.session.refresh();
    });
    expect(active.tokenChanged).toHaveBeenCalledTimes(1);

    await act(async () => {
      await services.session.logout();
    });
    expect(active.stop).toHaveBeenCalled();
  });

  it('al reconectar recupera alertas y estado general', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();
    const invalidate = vi.spyOn(services.queryClient, 'invalidateQueries');

    act(() => realtimeBus.setStatus('reconnecting'));
    act(() => realtimeBus.setStatus('connected'));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.alerts.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.general() });
  });

  it('en el escenario crítico la crítica nueva reemplaza la ocurrencia en vez de duplicarla', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const banner = await screen.findByRole('region', { name: 'Alertas críticas sin revisar' });
    expect(banner).toHaveTextContent('1 alerta crítica sin revisar');

    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });

    expect(banner).toHaveTextContent('1 alerta crítica sin revisar');
    expect(within(toastRegion()).getAllByText('Aceleración superior al umbral configurado')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — `createTestServices` no acepta overrides; no hay región "Notificaciones".

- [ ] **Step 3: Implementar servicios, configuración y factory simulada**

`apps/web/src/app/services.ts` — reemplazar por:
```ts
import {
  ApiError,
  ContractDriftError,
  createApi,
  createHttpClient,
  createSessionManager,
  type Api,
  type ContractDrift,
  type Role,
  type SessionManager,
  type TokenStore,
  type ValidationMode,
} from '@gd/api';
import { createIdleRealtimeClient, createRealtimeClient, type RealtimeClient } from '@gd/realtime';
import { QueryClient } from '@tanstack/react-query';

export interface RealtimeFactoryArgs {
  role: Role;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
}

export type RealtimeFactory = (args: RealtimeFactoryArgs) => RealtimeClient;

export interface Services {
  session: SessionManager;
  api: Api;
  queryClient: QueryClient;
  createRealtime(role: Role): RealtimeClient;
}

export interface ServicesOptions {
  baseUrl: string;
  store: TokenStore;
  validation: ValidationMode;
  onContractDrift?: (drift: ContractDrift) => void;
  queryClient?: QueryClient;
  /** Origen del servidor Socket.IO; sin URL ni factory no hay tiempo real. */
  realtimeUrl?: string;
  createRealtime?: RealtimeFactory;
}

// 429: la app ya muestra el mensaje de espera; reintentar solo martillaría una API con límite de tasa.
const NO_RETRY_STATUS = new Set([401, 403, 404, 422, 429]);

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ContractDriftError) return false;
  if (error instanceof ApiError && NO_RETRY_STATUS.has(error.status)) return false;
  return failureCount < 2;
}

function defaultQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: shouldRetryQuery,
      },
    },
  });
}

function defaultRealtimeFactory(url: string | undefined, onInvalidPayload: (payload: unknown) => void): RealtimeFactory {
  if (!url) return () => createIdleRealtimeClient();
  return (args) => createRealtimeClient({ url, onInvalidPayload, ...args });
}

export function createServices(options: ServicesOptions): Services {
  const session = createSessionManager({ baseUrl: options.baseUrl, store: options.store });
  const http = createHttpClient({
    baseUrl: options.baseUrl,
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refresh(),
    waitForReauth: () => session.waitForReauth(),
    validation: options.validation,
    onContractDrift: options.onContractDrift,
  });
  const factory =
    options.createRealtime ??
    defaultRealtimeFactory(options.realtimeUrl, (payload) =>
      options.onContractDrift?.({ method: 'SOCKET', path: 'alert:new', issues: [JSON.stringify(payload)] }),
    );
  return {
    session,
    api: createApi(http),
    queryClient: options.queryClient ?? defaultQueryClient(),
    createRealtime: (role) =>
      factory({
        role,
        getAccessToken: () => session.getAccessToken(),
        refreshAccessToken: () => session.refresh(),
      }),
  };
}
```

Añadir al final de `apps/web/src/mocks/realtime.ts`:
```ts
import type { RealtimeFactory } from '../app/services';

export const mockRealtimeFactory: RealtimeFactory = ({ role }) => createMockRealtimeClient(role);
```
(mover el `import type` al bloque de imports del archivo).

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_REALTIME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`apps/web/src/app/config.ts`:
```ts
import type { ValidationMode } from '@gd/api';

export const config: { useMocks: boolean; apiBaseUrl: string; realtimeUrl: string; validation: ValidationMode } = {
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin,
  validation: import.meta.env.DEV ? 'strict' : 'lenient',
};
```

`apps/web/src/test/renderApp.tsx`:
```tsx
import { MemoryTokenStore } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/routes';
import { createServices, type Services, type ServicesOptions } from '../app/services';
import type { AlertSound } from '../features/realtime/alertSound';
import { mockRealtimeFactory } from '../mocks/realtime';
import { ADMIN_EMAIL, DEMO_PASSWORD, RESIDENTE_EMAIL } from '../mocks/seed';

export function createTestServices(overrides: Partial<ServicesOptions> = {}): Services {
  return createServices({
    baseUrl: 'http://localhost',
    store: new MemoryTokenStore(),
    validation: 'strict',
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    createRealtime: mockRealtimeFactory,
    ...overrides,
  });
}

export async function loginAs(services: Services, who: 'admin' | 'residente'): Promise<void> {
  await services.session.login(who === 'admin' ? ADMIN_EMAIL : RESIDENTE_EMAIL, DEMO_PASSWORD);
}

/** Por defecto el sonido es inerte en tests (jsdom no tiene Web Audio). */
const silentSound: AlertSound = { play: async () => 'unsupported', unlock: async () => false };

export function renderApp(services: Services, route = '/', options: { sound?: AlertSound } = {}) {
  return render(
    <AppProviders services={services} sound={options.sound ?? silentSound}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}
```

- [ ] **Step 4: Implementar el proveedor y conectarlo**

`apps/web/src/features/realtime/alertToast.ts`:
```ts
import type { AlertResidente } from '@gd/api';
import type { ToastInput } from '../../ui/toast/ToastProvider';

export function alertToast(alert: AlertResidente): ToastInput {
  const tone = alert.level === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
  return {
    id: alert.alert_id,
    tone,
    title: tone === 'CRITICAL' ? 'Alerta crítica' : 'Advertencia',
    message: alert.message,
    href: `/alertas?alerta=${encodeURIComponent(alert.alert_id)}`,
    actionLabel: 'Ver alerta',
  };
}
```

`apps/web/src/features/realtime/RealtimeProvider.tsx`:
```tsx
import type { AlertResidente, Role } from '@gd/api';
import { applyAlertToCache, queryKeys } from '@gd/query';
import type { RealtimeClient, RealtimeStatus } from '@gd/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../../app/session/SessionProvider';
import { useToasts } from '../../ui/toast/ToastProvider';
import { createAlertSound, type AlertSound } from './alertSound';
import { alertToast } from './alertToast';
import { useTitleBadge } from './titleBadge';

interface RealtimeContextValue {
  status: RealtimeStatus;
  soundBlocked: boolean;
  enableSound(): Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  createRealtime: (role: Role) => RealtimeClient;
  sound?: AlertSound;
  children: ReactNode;
}

export function RealtimeProvider({ createRealtime, sound, children }: RealtimeProviderProps) {
  const { status: sessionStatus, session } = useSession();
  const queryClient = useQueryClient();
  const { show } = useToasts();
  const notifyTitle = useTitleBadge();
  const [alertSound] = useState<AlertSound>(() => sound ?? createAlertSound());
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [soundBlocked, setSoundBlocked] = useState(false);

  const authenticated = sessionStatus === 'authenticated' && session !== null;
  const role = authenticated ? session.claims.role : null;
  const sub = authenticated ? session.claims.sub : null;
  const accessToken = authenticated ? session.accessToken : null;

  const clientRef = useRef<RealtimeClient | null>(null);
  const accessTokenRef = useRef<string | null>(accessToken);
  const tokenAtStartRef = useRef<string | null>(null);

  const handleAlert = useCallback(
    (alert: AlertResidente) => {
      if (!role) return;
      applyAlertToCache(queryClient, role, alert);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sensors.list() });
      if (alert.level === 'INFO') return; // el backend no las emite; si llegan, solo se cachean
      show(alertToast(alert));
      notifyTitle(alert.level);
      if (alert.level === 'CRITICAL') {
        void alertSound.play().then((result) => setSoundBlocked(result === 'blocked'));
      }
    },
    [role, queryClient, show, notifyTitle, alertSound],
  );
  const handleAlertRef = useRef(handleAlert);

  useEffect(() => {
    handleAlertRef.current = handleAlert;
  }, [handleAlert]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Un cliente por usuario y rol mientras la sesión está activa.
  useEffect(() => {
    if (!role || !sub) return;
    const client = createRealtime(role);
    clientRef.current = client;
    tokenAtStartRef.current = accessTokenRef.current;
    let hasConnected = false;
    const offStatus = client.onStatus((next) => {
      setStatus(next);
      if (next !== 'connected') return;
      if (hasConnected) {
        // Reconexión: recuperar lo que pudo llegar mientras no había socket.
        void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() });
      }
      hasConnected = true;
    });
    const offAlert = client.onAlert((alert) => handleAlertRef.current(alert));
    client.start();
    return () => {
      offStatus();
      offAlert();
      client.stop();
      clientRef.current = null;
      setStatus('idle');
    };
  }, [role, sub, createRealtime, queryClient]);

  // Mismo usuario con token renovado: reconectar para que el servidor vea el nuevo.
  useEffect(() => {
    if (!accessToken || !clientRef.current || accessToken === tokenAtStartRef.current) return;
    tokenAtStartRef.current = accessToken;
    clientRef.current.tokenChanged();
  }, [accessToken]);

  const enableSound = useCallback(async () => {
    const unlocked = await alertSound.unlock();
    setSoundBlocked(!unlocked);
  }, [alertSound]);

  const value = useMemo(() => ({ status, soundBlocked, enableSound }), [status, soundBlocked, enableSound]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error('useRealtime debe usarse dentro de <RealtimeProvider>');
  return value;
}
```

`apps/web/src/app/AppProviders.tsx`:
```tsx
import { ApiProvider } from '@gd/query';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AlertSound } from '../features/realtime/alertSound';
import { RealtimeProvider } from '../features/realtime/RealtimeProvider';
import { ToastProvider } from '../ui/toast/ToastProvider';
import type { Services } from './services';
import { SessionProvider } from './session/SessionProvider';

interface AppProvidersProps {
  services: Services;
  sound?: AlertSound;
  children: ReactNode;
}

export function AppProviders({ services, sound, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={services.queryClient}>
      <ApiProvider api={services.api}>
        <SessionProvider manager={services.session}>
          <ToastProvider>
            <RealtimeProvider createRealtime={services.createRealtime} sound={sound}>
              {children}
            </RealtimeProvider>
          </ToastProvider>
        </SessionProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
```

`apps/web/src/app/layout/AppShell.tsx` — añadir el import `import { ToastViewport } from '../../ui/toast/ToastProvider';` y renderizar `<ToastViewport />` como último hijo del `div.shell` (después de `</main>`).

`apps/web/src/main.tsx` — reemplazar `start()` por:
```tsx
async function start() {
  let createRealtime: RealtimeFactory | undefined;
  let DevPanel: ComponentType | null = null;
  if (config.useMocks) {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
    ({ mockRealtimeFactory: createRealtime } = await import('./mocks/realtime'));
    const dev = await import('./mocks/DevPanel');
    if (dev.isDevPanelRequested()) DevPanel = dev.DevPanel;
  }
  const services = createServices({
    baseUrl: config.apiBaseUrl,
    store: new SessionStorageTokenStore(getSessionStorage()),
    validation: config.validation,
    onContractDrift: (drift) => console.warn('[contrato] respuesta fuera de contrato', drift),
    realtimeUrl: config.realtimeUrl,
    createRealtime,
  });
  const root = document.getElementById('root');
  if (!root) throw new Error('No se encontró #root');
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <AppProviders services={services}>
          <AppRoutes />
        </AppProviders>
      </BrowserRouter>
      {DevPanel && <DevPanel />}
    </StrictMode>,
  );
}
```
con los imports `import type { ComponentType } from 'react';` y `import { createServices, type RealtimeFactory } from './app/services';`.

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint; pnpm --filter @gd/web build`
Expected: PASS y build sin errores. Todos los tests anteriores siguen en verde (la región de notificaciones vive dentro del shell; los tests que usan `getByRole('alert')` están fuera de él). Si algún test previo se rompe solo porque ahora existen las regiones vivas vacías, acotar su consulta a la región correcta con `within(...)` en lugar de quitar las regiones.

- [ ] **Step 6: Commit**

```
git add apps/web
git commit -m "feat(web): tiempo real conectado a la sesión, la caché, las notificaciones y el sonido"
```

---

### Task 8: Cabecera — campana, indicador de conexión, sonido y banner sin conexión

**Files:**
- Create: `apps/web/src/app/connection/useOnlineStatus.ts`, `useLastDataUpdate.ts`, `connectionState.ts`, `connectionState.test.ts`, `useConnection.ts`, `ConnectionIndicator.tsx`, `OfflineBanner.tsx`, `Connection.module.css`
- Create: `apps/web/src/app/layout/AlertsBell.tsx`, `apps/web/src/app/layout/SoundButton.tsx`
- Modify: `apps/web/src/app/layout/Header.tsx`, `apps/web/src/app/layout/AppShell.tsx`, `apps/web/src/app/layout/AppShell.module.css`
- Test: `apps/web/src/app/layout/Header.test.tsx`

**Interfaces:**
- Consumes: `useRealtime` (Task 7), `useAlerts` (Plan 1), `formatRelative`, `useNow`.
- Produces:
  - `type ConnectionKind = 'live' | 'connecting' | 'offline'`; `connectionKind(online: boolean, status: RealtimeStatus): ConnectionKind`
  - `OFFLINE_BANNER_DELAY_MS = 5_000`; `shouldShowOfflineBanner(input: { online: boolean; kind: ConnectionKind; notLiveSince: number | null; now: number; delayMs?: number }): boolean` — sin red: inmediato; socket caído o reconectando: tras 5 s.
  - `useOnlineStatus(): boolean`; `useLastDataUpdate(): number | null`; `useConnection(): { kind: ConnectionKind; showBanner: boolean }`
  - `ConnectionIndicator({ kind })` (`role="status"`, icono + texto: "En vivo" / "Conectando…" / "Sin conexión")
  - `OfflineBanner({ visible })` — "Sin conexión con el servidor. Mostrando datos de hace X."
  - `AlertsBell({ role })` — enlace a `/alertas?acusada=false`, nombre accesible `Alertas: N sin revisar[, incluye críticas]` o `Alertas: ninguna sin revisar`.
  - `SoundButton()` — "Activar sonido" solo cuando `soundBlocked`.
  - `Header({ connection }: { connection: ConnectionKind })`.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/app/connection/connectionState.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { OFFLINE_BANNER_DELAY_MS, connectionKind, shouldShowOfflineBanner } from './connectionState';

describe('connectionKind', () => {
  it('sin red o con el socket caído es offline', () => {
    expect(connectionKind(false, 'connected')).toBe('offline');
    expect(connectionKind(true, 'disconnected')).toBe('offline');
  });
  it('solo "connected" es en vivo; el resto está conectando', () => {
    expect(connectionKind(true, 'connected')).toBe('live');
    expect(connectionKind(true, 'reconnecting')).toBe('connecting');
    expect(connectionKind(true, 'connecting')).toBe('connecting');
    expect(connectionKind(true, 'idle')).toBe('connecting');
  });
});

describe('shouldShowOfflineBanner', () => {
  const now = 100_000;
  it('sin red se muestra de inmediato', () => {
    expect(shouldShowOfflineBanner({ online: false, kind: 'offline', notLiveSince: now, now })).toBe(true);
  });
  it('en vivo nunca se muestra', () => {
    expect(shouldShowOfflineBanner({ online: true, kind: 'live', notLiveSince: null, now })).toBe(false);
  });
  it('una reconexión breve (rotación de token) no lo muestra', () => {
    expect(shouldShowOfflineBanner({ online: true, kind: 'connecting', notLiveSince: now - 2_000, now })).toBe(false);
  });
  it('tras 5 s sin socket se muestra', () => {
    expect(
      shouldShowOfflineBanner({ online: true, kind: 'offline', notLiveSince: now - OFFLINE_BANNER_DELAY_MS, now }),
    ).toBe(true);
  });
});
```

`apps/web/src/app/layout/Header.test.tsx`:
```tsx
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AlertSound } from '../../features/realtime/alertSound';
import { resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { realtimeBus } from '../../mocks/realtimeBus';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderAdmin(options: { sound?: AlertSound } = {}) {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderApp(services, '/', options);
  await screen.findByRole('region', { name: 'Salud del edificio' });
  return services;
}

describe('cabecera', () => {
  it('la campana cuenta las alertas sin revisar y enlaza a ellas', async () => {
    await renderAdmin();
    const bell = await screen.findByRole('link', { name: 'Alertas: 2 sin revisar' });
    expect(bell).toHaveAttribute('href', '/alertas?acusada=false');
  });

  it('la campana avisa cuando hay críticas', async () => {
    resetDb('critico');
    await renderAdmin();
    expect(await screen.findByRole('link', { name: 'Alertas: 4 sin revisar, incluye críticas' })).toBeInTheDocument();
  });

  it('una alerta por socket actualiza la campana al instante', async () => {
    await renderAdmin();
    await screen.findByRole('link', { name: 'Alertas: 2 sin revisar' });
    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    expect(screen.getByRole('link', { name: 'Alertas: 3 sin revisar, incluye críticas' })).toBeInTheDocument();
  });

  it('el indicador dice "En vivo" y cambia a "Sin conexión" si cae el socket', async () => {
    await renderAdmin();
    expect(screen.getByText('En vivo')).toBeInTheDocument();
    act(() => realtimeBus.setStatus('disconnected'));
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });

  it('sin red muestra el banner de inmediato', async () => {
    await renderAdmin();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByText('Sin conexión con el servidor.')).toBeInTheDocument();
  });

  it('si el navegador bloquea el audio ofrece "Activar sonido"', async () => {
    const unlock = vi.fn(async () => true);
    await renderAdmin({ sound: { play: async () => 'blocked', unlock } });
    expect(screen.queryByRole('button', { name: 'Activar sonido' })).not.toBeInTheDocument();
    await act(async () => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    const button = await screen.findByRole('button', { name: 'Activar sonido' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(unlock).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Activar sonido' })).not.toBeInTheDocument();
  });
});
```

Nota: si `vi.spyOn(navigator, 'onLine', 'get')` no puede espiar el getter en el jsdom instalado, usar `Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })` en ese test y restaurarlo en un `finally` (reponiendo el descriptor original obtenido con `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine')`).

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelve `./connectionState`; no hay campana ni indicador.

- [ ] **Step 3: Implementar la lógica de conexión**

`apps/web/src/app/connection/connectionState.ts`:
```ts
import type { RealtimeStatus } from '@gd/realtime';

export type ConnectionKind = 'live' | 'connecting' | 'offline';

export function connectionKind(online: boolean, status: RealtimeStatus): ConnectionKind {
  if (!online || status === 'disconnected') return 'offline';
  if (status === 'connected') return 'live';
  return 'connecting';
}

/** Evita mostrar el banner por reconexiones breves (p. ej. al rotar el token). */
export const OFFLINE_BANNER_DELAY_MS = 5_000;

export function shouldShowOfflineBanner(input: {
  online: boolean;
  kind: ConnectionKind;
  notLiveSince: number | null;
  now: number;
  delayMs?: number;
}): boolean {
  if (!input.online) return true;
  if (input.kind === 'live' || input.notLiveSince === null) return false;
  return input.now - input.notLiveSince >= (input.delayMs ?? OFFLINE_BANNER_DELAY_MS);
}
```

`apps/web/src/app/connection/useOnlineStatus.ts`:
```ts
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
```

`apps/web/src/app/connection/useLastDataUpdate.ts`:
```ts
import { useQueryClient, type QueryCache } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

function latestUpdate(cache: QueryCache): number {
  let latest = 0;
  for (const query of cache.getAll()) latest = Math.max(latest, query.state.dataUpdatedAt);
  return latest;
}

/** Instante (ms) del dato más reciente recibido por cualquier consulta, o null si aún no hay datos. */
export function useLastDataUpdate(): number | null {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(() => onChange()), [cache]);
  const latest = useSyncExternalStore(subscribe, () => latestUpdate(cache));
  return latest === 0 ? null : latest;
}
```

`apps/web/src/app/connection/useConnection.ts`:
```ts
import { useEffect, useState } from 'react';
import { useRealtime } from '../../features/realtime/RealtimeProvider';
import { useNow } from '../../ui/useNow';
import { connectionKind, shouldShowOfflineBanner, type ConnectionKind } from './connectionState';
import { useOnlineStatus } from './useOnlineStatus';

export function useConnection(): { kind: ConnectionKind; showBanner: boolean } {
  const online = useOnlineStatus();
  const { status } = useRealtime();
  const kind = connectionKind(online, status);
  const [notLiveSince, setNotLiveSince] = useState<number | null>(null);
  const now = useNow(1_000);

  useEffect(() => {
    setNotLiveSince((previous) => (kind === 'live' ? null : (previous ?? Date.now())));
  }, [kind]);

  return { kind, showBanner: shouldShowOfflineBanner({ online, kind, notLiveSince, now: now.getTime() }) };
}
```

`apps/web/src/app/connection/Connection.module.css`:
```css
.indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}
.indicator[data-kind='live'] { color: var(--status-ok-fg); }
.indicator[data-kind='connecting'] { color: var(--status-warning-fg); }
.indicator[data-kind='offline'] { color: var(--status-critical-fg); }
.banner {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--status-warning-bg);
  color: var(--status-warning-fg);
}
.banner p { margin: 0; }
@media (max-width: 767px) {
  .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
}
```

`apps/web/src/app/connection/ConnectionIndicator.tsx`:
```tsx
import { Radio, RefreshCw, WifiOff, type LucideIcon } from 'lucide-react';
import styles from './Connection.module.css';
import type { ConnectionKind } from './connectionState';

const META: Record<ConnectionKind, { label: string; Icon: LucideIcon }> = {
  live: { label: 'En vivo', Icon: Radio },
  connecting: { label: 'Conectando…', Icon: RefreshCw },
  offline: { label: 'Sin conexión', Icon: WifiOff },
};

export function ConnectionIndicator({ kind }: { kind: ConnectionKind }) {
  const { label, Icon } = META[kind];
  return (
    <span className={styles.indicator} data-kind={kind} role="status">
      <Icon aria-hidden="true" size={16} />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
```

`apps/web/src/app/connection/OfflineBanner.tsx`:
```tsx
import { formatRelative } from '@gd/domain';
import { WifiOff } from 'lucide-react';
import { useNow } from '../../ui/useNow';
import styles from './Connection.module.css';
import { useLastDataUpdate } from './useLastDataUpdate';

export function OfflineBanner({ visible }: { visible: boolean }) {
  const lastUpdate = useLastDataUpdate();
  const now = useNow();
  if (!visible) return null;
  const since = lastUpdate === null ? null : formatRelative(new Date(lastUpdate).toISOString(), now);
  const detail =
    since === null
      ? 'Mostrando los últimos datos disponibles.'
      : since === 'justo ahora'
        ? 'Mostrando los datos más recientes que recibimos.'
        : `Mostrando datos de ${since}.`;
  return (
    <div className={styles.banner} role="status">
      <WifiOff aria-hidden="true" size={20} />
      <p>
        <strong>Sin conexión con el servidor.</strong> {detail}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Implementar campana, botón de sonido, cabecera y shell**

`apps/web/src/app/layout/AlertsBell.tsx`:
```tsx
import type { Role } from '@gd/api';
import { useAlerts } from '@gd/query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import styles from './AppShell.module.css';

export function AlertsBell({ role }: { role: Role }) {
  const { data } = useAlerts(role, { acknowledged: false });
  const open = data?.data ?? [];
  const count = open.length;
  const hasCritical = open.some((alert) => alert.level === 'CRITICAL');
  const label =
    count === 0 ? 'Alertas: ninguna sin revisar' : `Alertas: ${count} sin revisar${hasCritical ? ', incluye críticas' : ''}`;
  return (
    <Link to="/alertas?acusada=false" className={styles.bell} aria-label={label} data-critical={hasCritical || undefined}>
      <Bell aria-hidden="true" size={20} />
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
```

`apps/web/src/app/layout/SoundButton.tsx`:
```tsx
import { Volume2 } from 'lucide-react';
import { useRealtime } from '../../features/realtime/RealtimeProvider';
import { Button } from '../../ui/Button';

export function SoundButton() {
  const { soundBlocked, enableSound } = useRealtime();
  if (!soundBlocked) return null;
  return (
    <Button variant="secondary" onClick={() => void enableSound()}>
      <Volume2 aria-hidden="true" size={18} />
      Activar sonido
    </Button>
  );
}
```

`apps/web/src/app/layout/Header.tsx`:
```tsx
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../ui/Button';
import { ConnectionIndicator } from '../connection/ConnectionIndicator';
import type { ConnectionKind } from '../connection/connectionState';
import { useSession } from '../session/SessionProvider';
import { AlertsBell } from './AlertsBell';
import styles from './AppShell.module.css';
import { SoundButton } from './SoundButton';

const ROLE_LABEL = { ADMIN: 'Administración', RESIDENTE: 'Residente' } as const;

export function Header({ connection }: { connection: ConnectionKind }) {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const name = session?.user?.name ?? session?.user?.email ?? 'Usuario';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className={styles.header}>
      <span className={styles.brand}>Gemelo Digital</span>
      <div className={styles.user}>
        <ConnectionIndicator kind={connection} />
        {session && <AlertsBell role={session.claims.role} />}
        <SoundButton />
        <span className={styles.userName}>
          {name}
          {session && ` · ${ROLE_LABEL[session.claims.role]}`}
        </span>
        <Button variant="secondary" onClick={() => void handleLogout()}>
          <LogOut aria-hidden="true" size={18} />
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
```

`apps/web/src/app/layout/AppShell.tsx`:
```tsx
import { Outlet, useLocation } from 'react-router';
import { ToastViewport } from '../../ui/toast/ToastProvider';
import { OfflineBanner } from '../connection/OfflineBanner';
import { useConnection } from '../connection/useConnection';
import styles from './AppShell.module.css';
import { Header } from './Header';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { pathname } = useLocation();
  const connection = useConnection();
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <Header connection={connection.kind} />
      <Sidebar />
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <OfflineBanner visible={connection.showBanner} />
        <RouteErrorBoundary resetKey={pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      <ToastViewport />
    </div>
  );
}
```

Añadir a `apps/web/src/app/layout/AppShell.module.css` (antes de las media queries):
```css
.bell {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius);
  color: var(--text);
}
.badge {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 20px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--status-info-fg);
  color: var(--surface);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
}
.bell[data-critical] .badge { background: var(--status-critical-fg); }
```
y dentro de `@media (max-width: 767px)`:
```css
  .userName { display: none; }
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (incluidos los tests de rutas y home del Plan 1).

- [ ] **Step 6: Commit**

```
git add apps/web/src/app
git commit -m "feat(web): campana de alertas, indicador de conexión, banner sin conexión y activar sonido"
```

---

### Task 9: Centro de alertas — lista y filtros

**Files:**
- Create: `apps/web/src/features/alerts/alertFilters.ts`, `alertFilters.test.ts`, `alertCopy.ts`, `AlertFiltersBar.tsx`, `AlertList.tsx`, `AlertsPage.tsx`, `Alerts.module.css`
- Modify: `apps/web/src/app/routes.tsx`
- Test: `apps/web/src/features/alerts/AlertsPage.test.tsx`

**Interfaces:**
- Consumes: `useAlerts`, `POLL_INTERVALS_MS` (`@gd/query`); `sortAlertsForInbox`, `formatRelative`, `AlertLevel` (`@gd/domain`); `isAdminAlert`, `AlertFilters`, `AlertResidente` (`@gd/api`); `DataState`, `StatusBadge`, `useNow`, `useSession`.
- Produces:
  - `interface AlertsView { level?: AlertLevel; acknowledged?: boolean; category?: 'structural' | 'consumption' | 'comfort'; alertId?: string }`
  - `readAlertsView(params: URLSearchParams): AlertsView` (ignora valores inválidos; `alerta` solo `[A-Za-z0-9_-]{1,64}`), `writeAlertsView(view: AlertsView): URLSearchParams` (claves `nivel`, `acusada`, `categoria`, `alerta`), `apiFilters(view: AlertsView): AlertFilters`
  - `categoryLabel(category: string): string`; `LEVEL_OPTIONS`, `STATE_OPTIONS`, `CATEGORY_OPTIONS`
  - `AlertsPage()` en la ruta `/alertas`; `AlertList({ alerts, view, isAdmin })`; `AlertFiltersBar({ view, onChange })`
  - Cada fila es un enlace `?…&alerta=<id>` (conserva filtros). En Task 10 se añade el panel de detalle.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/features/alerts/alertFilters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { apiFilters, readAlertsView, writeAlertsView } from './alertFilters';

describe('alertFilters', () => {
  it('lee nivel, estado, categoría y alerta', () => {
    const view = readAlertsView(
      new URLSearchParams('nivel=CRITICAL&acusada=false&categoria=structural&alerta=alrt-20261002-00004'),
    );
    expect(view).toEqual({ level: 'CRITICAL', acknowledged: false, category: 'structural', alertId: 'alrt-20261002-00004' });
  });

  it('ignora valores inválidos o maliciosos', () => {
    const view = readAlertsView(
      new URLSearchParams('nivel=PANICO&acusada=quizas&categoria=apartamento&alerta=%3Cscript%3E'),
    );
    expect(view).toEqual({});
    expect(readAlertsView(new URLSearchParams(`alerta=${'a'.repeat(65)}`))).toEqual({});
  });

  it('escribe en un orden estable y omite lo vacío', () => {
    expect(writeAlertsView({ acknowledged: true, level: 'WARNING' }).toString()).toBe('nivel=WARNING&acusada=true');
    expect(writeAlertsView({}).toString()).toBe('');
  });

  it('solo nivel y estado van a la API', () => {
    expect(apiFilters({ level: 'INFO', acknowledged: false, category: 'comfort', alertId: 'x' })).toEqual({
      level: 'INFO',
      acknowledged: false,
    });
    expect(apiFilters({})).toEqual({});
  });
});
```

`apps/web/src/features/alerts/AlertsPage.test.tsx`:
```tsx
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function openAlerts(who: 'admin' | 'residente', route = '/alertas') {
  const services = createTestServices();
  await loginAs(services, who);
  renderApp(services, route);
  return within(await screen.findByRole('list', { name: 'Alertas' }));
}

describe('centro de alertas', () => {
  it('ordena: sin revisar primero, la crítica arriba', async () => {
    resetDb('critico');
    const list = await openAlerts('admin');
    const rows = list.getAllByRole('link');
    expect(rows[0]).toHaveTextContent('Crítico');
    expect(rows.at(-1)).toHaveTextContent('Revisada');
  });

  it('el administrador ve las ocurrencias', async () => {
    resetDb('critico');
    const adminList = await openAlerts('admin');
    expect(adminList.getByText('×12 ocurrencias')).toBeInTheDocument();
  });

  it('el residente no ve ocurrencias', async () => {
    resetDb('critico');
    const list = await openAlerts('residente');
    expect(list.queryByText(/ocurrencias/)).not.toBeInTheDocument();
  });

  it('filtra por nivel desde la URL', async () => {
    resetDb('critico');
    const list = await openAlerts('admin', '/alertas?nivel=WARNING');
    const rows = list.getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toHaveTextContent('Advertencia');
  });

  it('filtra por categoría en el cliente', async () => {
    resetDb('critico');
    await openAlerts('admin');
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'comfort' } });
    const list = within(await screen.findByRole('list', { name: 'Alertas' }));
    for (const row of list.getAllByRole('link')) expect(row).toHaveTextContent('Calidad del aire');
  });

  it('parámetros inválidos muestran todas las alertas', async () => {
    resetDb('critico');
    const list = await openAlerts('admin', '/alertas?nivel=PANICO&categoria=apartamento');
    expect(list.getAllByRole('link')).toHaveLength(5);
  });

  it('sin alertas muestra el estado vacío', async () => {
    resetDb('vacio');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/alertas');
    expect(await screen.findByText('No hay alertas con estos filtros.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — módulos de `features/alerts` no encontrados.

- [ ] **Step 3: Implementar**

`apps/web/src/features/alerts/alertFilters.ts`:
```ts
import type { AlertFilters } from '@gd/api';
import type { AlertLevel } from '@gd/domain';

const LEVELS: readonly AlertLevel[] = ['CRITICAL', 'WARNING', 'INFO'];
const CATEGORIES = ['structural', 'consumption', 'comfort'] as const;
type Category = (typeof CATEGORIES)[number];
const ALERT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface AlertsView {
  level?: AlertLevel;
  acknowledged?: boolean;
  category?: Category;
  alertId?: string;
}

function isLevel(value: string | null): value is AlertLevel {
  return value !== null && (LEVELS as readonly string[]).includes(value);
}

function isCategory(value: string | null): value is Category {
  return value !== null && (CATEGORIES as readonly string[]).includes(value);
}

export function readAlertsView(params: URLSearchParams): AlertsView {
  const view: AlertsView = {};
  const level = params.get('nivel');
  if (isLevel(level)) view.level = level;
  const acknowledged = params.get('acusada');
  if (acknowledged === 'true' || acknowledged === 'false') view.acknowledged = acknowledged === 'true';
  const category = params.get('categoria');
  if (isCategory(category)) view.category = category;
  const alertId = params.get('alerta');
  if (alertId !== null && ALERT_ID.test(alertId)) view.alertId = alertId;
  return view;
}

export function writeAlertsView(view: AlertsView): URLSearchParams {
  const params = new URLSearchParams();
  if (view.level) params.set('nivel', view.level);
  if (view.acknowledged !== undefined) params.set('acusada', String(view.acknowledged));
  if (view.category) params.set('categoria', view.category);
  if (view.alertId) params.set('alerta', view.alertId);
  return params;
}

/** Nivel y estado los filtra la API; la categoría se filtra en el cliente. */
export function apiFilters(view: AlertsView): AlertFilters {
  const filters: AlertFilters = {};
  if (view.level) filters.level = view.level;
  if (view.acknowledged !== undefined) filters.acknowledged = view.acknowledged;
  return filters;
}
```

`apps/web/src/features/alerts/alertCopy.ts`:
```ts
const CATEGORY_LABEL: Record<string, string> = {
  structural: 'Estructural',
  consumption: 'Consumos',
  comfort: 'Calidad del aire',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

export const LEVEL_OPTIONS = [
  { value: '', label: 'Todos los niveles' },
  { value: 'CRITICAL', label: 'Crítico' },
  { value: 'WARNING', label: 'Advertencia' },
  { value: 'INFO', label: 'Informativo' },
] as const;

export const STATE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'false', label: 'Sin revisar' },
  { value: 'true', label: 'Revisadas' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'structural', label: 'Estructural' },
  { value: 'consumption', label: 'Consumos' },
  { value: 'comfort', label: 'Calidad del aire' },
] as const;
```

`apps/web/src/features/alerts/Alerts.module.css`:
```css
.page { display: grid; gap: var(--space-4); }
.page h1 { margin: 0; }
.intro { margin: var(--space-1) 0 0; color: var(--text-muted); }
.filters { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: end; }
.filters label { display: grid; gap: var(--space-1); font-size: 0.875rem; font-weight: 600; }
.filters select {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
}
.layout { display: grid; gap: var(--space-4); }
@media (min-width: 1024px) {
  .layout[data-detail='open'] { grid-template-columns: minmax(0, 1fr) minmax(320px, 420px); align-items: start; }
}
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-3);
  align-items: center;
  min-height: 56px;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
}
.row[aria-current='true'] { outline: 2px solid var(--accent); outline-offset: -2px; }
.row[data-acknowledged] { opacity: 0.75; }
.rowMain { display: grid; gap: 2px; min-width: 0; }
.message { font-weight: 600; }
.meta { color: var(--text-muted); font-size: 0.8125rem; overflow-wrap: anywhere; }
.tags { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: end; }
.tag {
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--status-offline-bg);
  color: var(--status-offline-fg);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}
@media (max-width: 767px) {
  .row { grid-template-columns: 1fr; }
  .tags { justify-content: start; }
}
```

`apps/web/src/features/alerts/AlertFiltersBar.tsx`:
```tsx
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
```

`apps/web/src/features/alerts/AlertList.tsx`:
```tsx
import { isAdminAlert, type AlertResidente } from '@gd/api';
import { formatRelative } from '@gd/domain';
import { Link } from 'react-router';
import { StatusBadge } from '../../ui/StatusBadge';
import { useNow } from '../../ui/useNow';
import { categoryLabel } from './alertCopy';
import { writeAlertsView, type AlertsView } from './alertFilters';
import styles from './Alerts.module.css';

interface AlertListProps {
  alerts: AlertResidente[];
  view: AlertsView;
  isAdmin: boolean;
}

export function AlertList({ alerts, view, isAdmin }: AlertListProps) {
  const now = useNow();
  return (
    <ul className={styles.list} aria-label="Alertas">
      {alerts.map((alert) => (
        <li key={alert.alert_id}>
          <Link
            to={`?${writeAlertsView({ ...view, alertId: alert.alert_id }).toString()}`}
            className={styles.row}
            aria-current={view.alertId === alert.alert_id ? 'true' : undefined}
            data-acknowledged={alert.acknowledged || undefined}
          >
            <StatusBadge level={alert.level} />
            <span className={styles.rowMain}>
              <span className={styles.message}>{alert.message}</span>
              <span className={styles.meta}>
                {alert.sensor_id} · {categoryLabel(alert.category)} · {formatRelative(alert.timestamp, now)}
              </span>
            </span>
            <span className={styles.tags}>
              {isAdmin && isAdminAlert(alert) && alert.occurrence_count > 1 && (
                <span className={styles.tag}>×{alert.occurrence_count} ocurrencias</span>
              )}
              {alert.acknowledged && <span className={styles.tag}>Revisada</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`apps/web/src/features/alerts/AlertsPage.tsx`:
```tsx
import type { AlertResidente } from '@gd/api';
import { sortAlertsForInbox } from '@gd/domain';
import { POLL_INTERVALS_MS, useAlerts } from '@gd/query';
import { useSearchParams } from 'react-router';
import { useSession } from '../../app/session/SessionProvider';
import { DataState } from '../../ui/DataState';
import { AlertFiltersBar } from './AlertFiltersBar';
import { AlertList } from './AlertList';
import { apiFilters, readAlertsView, writeAlertsView, type AlertsView } from './alertFilters';
import styles from './Alerts.module.css';

function visibleAlerts(alerts: AlertResidente[], view: AlertsView): AlertResidente[] {
  const filtered = view.category ? alerts.filter((a) => a.category === view.category) : alerts;
  return sortAlertsForInbox(filtered);
}

export function AlertsPage() {
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const view = readAlertsView(params);
  const role = session?.claims.role ?? 'RESIDENTE';
  const query = useAlerts(role, apiFilters(view));

  if (!session) return null;

  return (
    <div className={styles.page}>
      <header>
        <h1>Alertas</h1>
        <p className={styles.intro}>Avisos de cambios medibles detectados en las zonas comunes.</p>
      </header>
      <AlertFiltersBar view={view} onChange={(next) => setParams(writeAlertsView(next), { replace: true })} />
      <div className={styles.layout} data-detail={view.alertId ? 'open' : undefined}>
        <section aria-label="Lista de alertas">
          <DataState
            label="alertas"
            query={query}
            staleAfterMs={POLL_INTERVALS_MS.alerts * 2}
            isEmpty={(data) => visibleAlerts(data.data, view).length === 0}
            emptyMessage="No hay alertas con estos filtros."
          >
            {(data) => <AlertList alerts={visibleAlerts(data.data, view)} view={view} isAdmin={role === 'ADMIN'} />}
          </DataState>
        </section>
      </div>
    </div>
  );
}
```

En `apps/web/src/app/routes.tsx`: importar `AlertsPage` desde `../features/alerts/AlertsPage` y cambiar `<Route path="alertas" element={<PendingSection title="Alertas" />} />` por `<Route path="alertas" element={<AlertsPage />} />`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (incluido `routes.test.tsx`; si algún test del Plan 1 buscaba el encabezado "Alertas" del marcador, sigue existiendo como `h1`).

- [ ] **Step 5: Commit**

```
git add apps/web/src/features/alerts apps/web/src/app/routes.tsx
git commit -m "feat(web): centro de alertas con filtros en la URL y orden de bandeja"
```

---

### Task 10: Detalle de alerta y acuse con confirmación

**Files:**
- Create: `apps/web/src/ui/ConfirmDialog.tsx`, `apps/web/src/ui/ConfirmDialog.module.css`
- Create: `apps/web/src/features/alerts/AlertDetailPanel.tsx`
- Modify: `apps/web/src/features/alerts/AlertsPage.tsx`, `apps/web/src/features/alerts/Alerts.module.css`
- Test: `apps/web/src/features/alerts/AlertDetailPanel.test.tsx`

**Interfaces:**
- Consumes: `useAckAlert`, `useAlerts` (`@gd/query`); `isAdminAlert` (`@gd/api`); `formatDateTime`, `formatNumber` (`@gd/domain`); `useToasts` (Task 5); `errorMessage`, `Button`, `StatusBadge`.
- Produces:
  - `ConfirmDialog({ title, description, confirmLabel, cancelLabel?, onConfirm, onCancel })` — `role="alertdialog"`, `aria-modal`, foco inicial en Cancelar, Escape cancela.
  - `AlertDetailPanel({ alertId, role, onClose })` — `<aside aria-labelledby>` con título "Detalle de la alerta" (recibe el foco), botón "Cerrar detalle", Escape cierra (salvo con el diálogo abierto); al abrir cierra el toast de esa alerta.
  - ADMIN: "Valor medido", "Umbral configurado", "Ocurrencias", "Revisada por"/"Revisada el"; acciones "Marcar como revisada", "Ver sensor" (`/sensores?sensor=`), "Ver en 3D" (`/gemelo?sensor=`), "Crear tarea de mantenimiento" (`/mantenimiento?nueva=1&descripcion=`). RESIDENTE: solo datos sin números y sin acciones.
  - Error de acuse: `role="alert"` con "No se pudo marcar la alerta como revisada. …".

- [ ] **Step 1: Escribir el test que falla**

`apps/web/src/features/alerts/AlertDetailPanel.test.tsx`:
```tsx
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { db, resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { server } from '../../mocks/server';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

function criticalId(): string {
  const found = db.alerts.find((a) => a.level === 'CRITICAL');
  if (!found) throw new Error('el escenario no tiene alerta crítica');
  return found.alert_id;
}

async function openDetail(who: 'admin' | 'residente', alertId: string) {
  const services = createTestServices();
  await loginAs(services, who);
  renderApp(services, `/alertas?alerta=${alertId}`);
  const panel = await screen.findByRole('complementary', { name: 'Detalle de la alerta' });
  await within(panel).findByText('Aceleración superior al umbral configurado');
  return within(panel);
}

function fact(panel: ReturnType<typeof within>, term: string) {
  const dt = panel.getByText(term, { selector: 'dt' });
  return dt.nextElementSibling;
}

describe('detalle de alerta', () => {
  it('el administrador ve valor medido, umbral y ocurrencias', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    expect(fact(panel, 'Valor medido')).toHaveTextContent('0,35');
    expect(fact(panel, 'Umbral configurado')).toHaveTextContent('0,2');
    expect(fact(panel, 'Ocurrencias')).toHaveTextContent('12');
    expect(fact(panel, 'Estado')).toHaveTextContent('Sin revisar');
  });

  it('el residente no ve números ni puede marcarla', async () => {
    resetDb('critico');
    const panel = await openDetail('residente', criticalId());
    expect(panel.queryByText('Valor medido')).not.toBeInTheDocument();
    expect(panel.queryByText('Umbral configurado')).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Marcar como revisada' })).not.toBeInTheDocument();
  });

  it('marca como revisada al instante y confirma con el servidor', async () => {
    resetDb('critico');
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/api/v1/alerts/:id/ack', async ({ params }) => {
        await gate;
        const alert = db.alerts.find((a) => a.alert_id === String(params.id));
        if (!alert) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });
        Object.assign(alert, { acknowledged: true, acknowledged_by: 'Administración Demo', acknowledged_at: new Date().toISOString() });
        return HttpResponse.json(alert);
      }),
    );
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Marcar esta alerta como revisada?' });
    expect(dialog).toHaveTextContent('Esto no resuelve la condición; si persiste, se volverá a registrar.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como revisada' }));

    // El servidor sigue retenido por `gate`: lo que se ve es la actualización optimista.
    await waitFor(() => expect(fact(panel, 'Estado')).toHaveTextContent('Revisada'));
    expect(panel.queryByRole('button', { name: 'Marcar como revisada' })).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
    expect(await panel.findByText('Administración Demo')).toBeInTheDocument();
  });

  it('si el servidor falla revierte y lo dice', async () => {
    resetDb('critico');
    db.settings.failNextAck = true;
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Marcar como revisada' }));
    expect(await panel.findByRole('alert')).toHaveTextContent('No se pudo marcar la alerta como revisada.');
    expect(fact(panel, 'Estado')).toHaveTextContent('Sin revisar');
  });

  it('cancelar el diálogo no envía nada', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fact(panel, 'Estado')).toHaveTextContent('Sin revisar');
    expect(db.alerts.find((a) => a.alert_id === criticalId())?.acknowledged).toBe(false);
  });

  it('Escape cierra el detalle', async () => {
    resetDb('critico');
    await openDetail('admin', criticalId());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Detalle de la alerta' })).not.toBeInTheDocument();
  });

  it('una alerta inexistente lo dice sin romper', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/alertas?alerta=alrt-00000000-99999');
    expect(await screen.findByText('No encontramos esta alerta. Puede que ya no exista.')).toBeInTheDocument();
  });

  it('desde el banner del home se llega al detalle en un clic', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const banner = await screen.findByRole('region', { name: 'Alertas críticas sin revisar' });
    await userEvent.click(within(banner).getByRole('link', { name: 'Ver alerta' }));
    expect(await screen.findByRole('complementary', { name: 'Detalle de la alerta' })).toBeInTheDocument();
  });

  it('abrir la alerta cierra su notificación', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await screen.findByRole('region', { name: 'Salud del edificio' });
    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    const toasts = screen.getByRole('region', { name: 'Notificaciones' });
    await userEvent.click(within(toasts).getByRole('link', { name: 'Ver alerta' }));
    await screen.findByRole('complementary', { name: 'Detalle de la alerta' });
    expect(within(toasts).getByRole('alert')).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no existe el panel de detalle.

- [ ] **Step 3: Implementar el diálogo de confirmación**

`apps/web/src/ui/ConfirmDialog.module.css`:
```css
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgb(0 0 0 / 0.5);
}
.dialog {
  width: 100%;
  max-width: 440px;
  max-height: calc(100vh - 2 * var(--space-4));
  overflow-y: auto;
  padding: var(--space-6);
  border-radius: var(--radius);
  background: var(--surface);
}
.dialog h2 { margin: 0 0 var(--space-2); font-size: 1.25rem; }
.dialog p { margin: 0 0 var(--space-6); color: var(--text-muted); }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: end; }
```

`apps/web/src/ui/ConfirmDialog.tsx`:
```tsx
import { useEffect, useId } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, description, confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implementar el panel y conectarlo a la página**

Añadir a `apps/web/src/features/alerts/Alerts.module.css`:
```css
.detail {
  position: sticky;
  top: var(--space-4);
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.detailHeader { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.detailHeader h2 { margin: 0; font-size: 1.125rem; }
.close {
  min-width: 44px;
  min-height: 44px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.detailMessage { margin: 0; font-weight: 600; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-4); margin: 0; }
.facts dt { color: var(--text-muted); }
.facts dd { margin: 0; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.actions a { min-height: 44px; display: inline-flex; align-items: center; color: var(--accent); font-weight: 600; }
.error {
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--status-critical-bg);
  color: var(--status-critical-fg);
}
@media (max-width: 1023px) {
  .detail { position: fixed; inset: auto 0 0 0; z-index: 120; max-height: 80vh; overflow-y: auto; border-radius: var(--radius) var(--radius) 0 0; box-shadow: 0 -8px 24px rgb(0 0 0 / 0.2); }
}
```

`apps/web/src/features/alerts/AlertDetailPanel.tsx`:
```tsx
import { isAdminAlert, type AlertResidente, type Role } from '@gd/api';
import { formatDateTime, formatNumber } from '@gd/domain';
import { useAckAlert, useAlerts } from '@gd/query';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../app/errorMessage';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { StatusBadge } from '../../ui/StatusBadge';
import { useToasts } from '../../ui/toast/ToastProvider';
import { categoryLabel } from './alertCopy';
import styles from './Alerts.module.css';

interface AlertDetailPanelProps {
  alertId: string;
  role: Role;
  onClose: () => void;
}

export function AlertDetailPanel({ alertId, role, onClose }: AlertDetailPanelProps) {
  const all = useAlerts(role, {});
  const ack = useAckAlert();
  const { dismiss } = useToasts();
  const [confirming, setConfirming] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alert = all.data?.data.find((a) => a.alert_id === alertId);

  useEffect(() => {
    headingRef.current?.focus();
    setAckError(null);
    dismiss(alertId); // abrir la alerta cierra su notificación persistente
  }, [alertId, dismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirming, onClose]);

  function confirmAck(target: AlertResidente) {
    setConfirming(false);
    setAckError(null);
    ack.mutate(target.alert_id, {
      onError: (error) => setAckError(`No se pudo marcar la alerta como revisada. ${errorMessage(error)}`),
    });
  }

  return (
    <aside className={styles.detail} aria-labelledby="alert-detail-title">
      <div className={styles.detailHeader}>
        <h2 id="alert-detail-title" ref={headingRef} tabIndex={-1}>
          Detalle de la alerta
        </h2>
        <button type="button" className={styles.close} aria-label="Cerrar detalle" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      {all.isPending ? (
        <p role="status">Cargando alerta…</p>
      ) : all.isError && !all.data ? (
        <p className={styles.error}>{errorMessage(all.error)}</p>
      ) : !alert ? (
        <p>No encontramos esta alerta. Puede que ya no exista.</p>
      ) : (
        <>
          <StatusBadge level={alert.level} />
          <p className={styles.detailMessage}>{alert.message}</p>
          <dl className={styles.facts}>
            <dt>Fecha</dt>
            <dd>{formatDateTime(alert.timestamp)}</dd>
            <dt>Categoría</dt>
            <dd>{categoryLabel(alert.category)}</dd>
            <dt>Sensor</dt>
            <dd>{alert.sensor_id}</dd>
            <dt>Estado</dt>
            <dd>{alert.acknowledged ? 'Revisada' : 'Sin revisar'}</dd>
            {role === 'ADMIN' && isAdminAlert(alert) && (
              <>
                <dt>Valor medido</dt>
                <dd>{formatNumber(alert.value_triggered, 2)}</dd>
                <dt>Umbral configurado</dt>
                <dd>{formatNumber(alert.threshold_configured, 2)}</dd>
                <dt>Ocurrencias</dt>
                <dd>{alert.occurrence_count}</dd>
                {alert.acknowledged && (
                  <>
                    <dt>Revisada por</dt>
                    <dd>{alert.acknowledged_by ?? '—'}</dd>
                    <dt>Revisada el</dt>
                    <dd>{formatDateTime(alert.acknowledged_at)}</dd>
                  </>
                )}
              </>
            )}
          </dl>

          {ackError && (
            <p className={styles.error} role="alert">
              {ackError}
            </p>
          )}

          {role === 'ADMIN' && (
            <div className={styles.actions}>
              {!alert.acknowledged && <Button onClick={() => setConfirming(true)}>Marcar como revisada</Button>}
              <Link to={`/sensores?sensor=${encodeURIComponent(alert.sensor_id)}`}>Ver sensor</Link>
              <Link to={`/gemelo?sensor=${encodeURIComponent(alert.sensor_id)}`}>Ver en 3D</Link>
              <Link
                to={`/mantenimiento?nueva=1&descripcion=${encodeURIComponent(
                  `Revisar sensor ${alert.sensor_id} – alerta ${alert.alert_id}`,
                )}`}
              >
                Crear tarea de mantenimiento
              </Link>
            </div>
          )}

          {confirming && (
            <ConfirmDialog
              title="¿Marcar esta alerta como revisada?"
              description="Esto no resuelve la condición; si persiste, se volverá a registrar."
              confirmLabel="Marcar como revisada"
              onCancel={() => setConfirming(false)}
              onConfirm={() => confirmAck(alert)}
            />
          )}
        </>
      )}
    </aside>
  );
}
```

En `apps/web/src/features/alerts/AlertsPage.tsx`:
- añadir imports `import { useCallback } from 'react';` y `import { AlertDetailPanel } from './AlertDetailPanel';`
- antes del `if (!session) return null;`, definir:
```tsx
  const closeDetail = useCallback(() => {
    setParams(
      (previous) => {
        const next = readAlertsView(previous);
        delete next.alertId;
        return writeAlertsView(next);
      },
      { replace: true },
    );
  }, [setParams]);
```
- dentro del `div.layout`, después de la `section`, añadir:
```tsx
        {view.alertId && <AlertDetailPanel alertId={view.alertId} role={role} onClose={closeDetail} />}
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS, salida limpia (sin advertencias de `act`).

- [ ] **Step 6: Commit**

```
git add apps/web/src/ui apps/web/src/features/alerts
git commit -m "feat(web): detalle de alerta y acuse optimista con confirmación"
```

---

### Task 11: Pruebas E2E de alertas y tiempo real

**Files:**
- Create: `apps/web/e2e/realtime.spec.ts`, `apps/web/e2e/alerts.spec.ts`

**Interfaces:**
- Consumes: app en modo mock; `window.__gdMocks.{emitAlert, setRealtimeStatus, failNextAck}` (Task 4); helpers `login`, `expectHome`, `ADMIN`, `RESIDENTE` (Plan 1).
- Produces: escenarios E2E en `tablet` y `escritorio`.

- [ ] **Step 1: Escribir los specs**

`apps/web/e2e/realtime.spec.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('una alerta crítica en tiempo real se abre en un clic desde la notificación', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await expect(page.getByRole('link', { name: 'Alertas: 2 sin revisar' })).toBeVisible();

  const alertId = await page.evaluate(() => window.__gdMocks?.emitAlert('CRITICAL'));
  const criticalToasts = page.getByRole('region', { name: 'Notificaciones' }).getByRole('alert');
  await expect(criticalToasts).toContainText('Aceleración superior al umbral configurado');
  await expect(page.getByRole('link', { name: 'Alertas: 3 sin revisar, incluye críticas' })).toBeVisible();

  await criticalToasts.getByRole('link', { name: 'Ver alerta' }).click();
  await expect(page).toHaveURL(new RegExp(`/alertas\\?alerta=${alertId}$`));
  await expect(page.getByRole('heading', { name: 'Detalle de la alerta' })).toBeVisible();
  await expect(criticalToasts).toBeEmpty();
});

test('una advertencia se cierra sola a los 8 segundos', async ({ page }) => {
  await page.clock.install();
  await login(page, ADMIN);
  await expectHome(page);
  await page.evaluate(() => window.__gdMocks?.emitAlert('WARNING'));
  const warnings = page.getByRole('region', { name: 'Notificaciones' }).getByRole('status');
  await expect(warnings).toContainText('Cambio medido en la apertura de fisura');
  await page.clock.fastForward('00:09');
  await expect(warnings).toBeEmpty();
});

test('si cae el tiempo real el indicador lo dice y el banner aparece a los 5 s', async ({ page }) => {
  await page.clock.install();
  await login(page, ADMIN);
  await expectHome(page);
  await expect(page.getByText('En vivo')).toBeVisible();
  await page.evaluate(() => window.__gdMocks?.setRealtimeStatus('disconnected'));
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
  await page.clock.fastForward('00:06');
  await expect(page.getByText('Sin conexión con el servidor.')).toBeVisible();
  await page.evaluate(() => window.__gdMocks?.setRealtimeStatus('connected'));
  await expect(page.getByText('En vivo')).toBeVisible();
  await expect(page.getByText('Sin conexión con el servidor.')).toBeHidden();
});

test('sin red el banner aparece de inmediato', async ({ page, context }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await context.setOffline(true);
  await expect(page.getByText('Sin conexión con el servidor.')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Sin conexión con el servidor.')).toBeHidden();
});

test('notificación y detalle sin violaciones WCAG AA', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  const alertId = await page.evaluate(() => window.__gdMocks?.emitAlert('CRITICAL'));
  await expect(page.getByRole('region', { name: 'Notificaciones' }).getByRole('alert')).toContainText('Alerta crítica');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);

  await page.goto(`/alertas?alerta=${alertId}`);
  await expect(page.getByRole('heading', { name: 'Detalle de la alerta' })).toBeVisible();
  await expect(page.getByText('Valor medido')).toBeVisible();
  const detail = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(detail.violations).toEqual([]);
});
```

`apps/web/e2e/alerts.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, RESIDENTE, expectHome, login } from './helpers';

test('crítica en ≤2 clics desde la campana y acuse optimista', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);

  await page.getByRole('link', { name: /Alertas: 4 sin revisar, incluye críticas/ }).click();
  const list = page.getByRole('list', { name: 'Alertas' });
  await list.getByRole('link').first().click();

  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  await expect(panel).toContainText('Aceleración superior al umbral configurado');
  await panel.getByRole('button', { name: 'Marcar como revisada' }).click();

  const dialog = page.getByRole('alertdialog', { name: '¿Marcar esta alerta como revisada?' });
  await expect(dialog).toContainText('Esto no resuelve la condición; si persiste, se volverá a registrar.');
  await dialog.getByRole('button', { name: 'Marcar como revisada' }).click();

  await expect(panel.getByText('Revisada', { exact: true })).toBeVisible();
  await expect(panel.getByText('Administración Demo')).toBeVisible();
});

test('si el servidor falla el acuse se revierte y se informa', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.getByRole('region', { name: 'Alertas críticas sin revisar' }).getByRole('link', { name: 'Ver alerta' }).click();

  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  await expect(panel).toContainText('Sin revisar');
  await page.evaluate(() => window.__gdMocks?.failNextAck());
  await panel.getByRole('button', { name: 'Marcar como revisada' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como revisada' }).click();

  await expect(panel.getByRole('alert')).toContainText('No se pudo marcar la alerta como revisada.');
  await expect(panel).toContainText('Sin revisar');
});

test('el residente consulta alertas sin números y sin poder marcarlas', async ({ page }) => {
  await login(page, RESIDENTE, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/alertas');
  const list = page.getByRole('list', { name: 'Alertas' });
  await expect(list.getByRole('link').first()).toContainText('Crítico');
  await expect(list).not.toContainText('ocurrencias');

  await list.getByRole('link').first().click();
  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  await expect(panel).toContainText('Aceleración superior al umbral configurado');
  await expect(panel.getByText('Valor medido')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Marcar como revisada' })).toHaveCount(0);
});

test('los filtros viven en la URL', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/alertas');
  await page.getByLabel('Nivel').selectOption('WARNING');
  await expect(page).toHaveURL(/\/alertas\?nivel=WARNING$/);
  for (const row of await page.getByRole('list', { name: 'Alertas' }).getByRole('link').all()) {
    await expect(row).toContainText('Advertencia');
  }
  await page.reload();
  await expect(page.getByLabel('Nivel')).toHaveValue('WARNING');
});
```

- [ ] **Step 2: Correr la suite E2E**

Run: `pnpm e2e`
Expected: todo en verde en `tablet` y `escritorio` (los specs del Plan 1 incluidos). Si un spec falla por una espera insuficiente, usar esperas por condición (`toBeVisible`, `toContainText`), nunca `waitForTimeout`. Si axe reporta contraste, corregir el token en `tokens.css`.

- [ ] **Step 3: Verificación completa**

Run: `pnpm lint; pnpm typecheck; pnpm test; pnpm e2e`
Expected: todo en verde; ningún servidor ni navegador queda corriendo.

- [ ] **Step 4: Commit**

```
git add apps/web/e2e
git commit -m "test(web): E2E de alertas en tiempo real, acuse y conexión"
```

---

## Cobertura del spec en este plan

| Spec | Cubierto en | Pendiente para |
|---|---|---|
| §5.1 Paquete `@gd/realtime` | Task 3 | — |
| §6 Campana, indicador de conexión, ≤2 clics a una crítica | Tasks 8, 9, 10, 11 | — |
| §7.4 / §8.1 Socket con token, reconexión al rotar, `connect_error` → refresh, catch-up al reconectar | Tasks 3, 7 | Contrato real del handshake/errores (Plan 5, `contract.spec`) |
| §8.1 Toasts (CRITICAL persistente + sonido, WARNING 8 s), título de pestaña, "activar sonido" | Tasks 5, 6, 7, 8 | — |
| §8.2 Banner "Sin conexión, mostrando datos de hace X" | Task 8 | — |
| §10.1 Centro de alertas: filtros, orden, ocurrencias, detalle, acuse con confirmación, optimista, enlaces a sensor/3D/mantenimiento | Tasks 9, 10 | Páginas destino de esos enlaces (Planes 3, 4, 5) |
| §11 Accesibilidad (regiones vivas, diálogo, foco, objetivos ≥44 px) | Tasks 5, 8, 10, 11 | — |
| §12.2 Socket simulado + panel `?dev=1` | Task 4 | — |

## Notas de ejecución (2026-10-02)

- Rulings de ejecución: P2-R2 (invalidar tras `tokenChanged`), P2-R3 (`describeInvalidPayload` sin payload crudo), P2-R4 (`clear` de toasts y título al pasar a anónimo o cambiar de `sub`), P2-R5 (los tests esperan los datos antes de emitir), P2-R6 (foco visible de la fila seleccionada), P2-R7 (primera/última vez no implementada), P2-R8 (el fallo del acuse también se avisa por toast WARNING), R-I3 (un `ContractDriftError` en el acuse no revierte lo optimista; la invalidación reconcilia). Además, la invalidación de alertas y estado general ahora ocurre en cada transición a `connected`, incluida la primera.
- Pendiente (no implementado): filtros por sensor y por fechas del §10.1 → Plan 3 (junto a la tabla de sensores). Móvil 390 px: añadido el test E2E `mobile-header.spec.ts`.
- Pedidos al backend para el spec §14: (1) semántica del rechazo del handshake (qué `connect_error`/data distingue token inválido o vencido de otros rechazos); (2) payload de `alert:new` por rol (¿quita números para RESIDENTE? ¿salas por edificio? ¿nunca emite INFO?); (3) cuerpo de respuesta de `POST /alerts/:id/ack` (se asume la alerta admin completa) y si `acknowledged_by` es id o nombre; (4) primera/última ocurrencia; (5) `alert:updated`.
- Interfaces que deben respetar los Planes 3–5: rutas `/sensores?sensor=`, `/gemelo?sensor=`, `/mantenimiento?nueva=1&descripcion=`; el Plan 3 debe añadir `dashboard/structural` y las claves de estado de sensores/3D a las invalidaciones de `RealtimeProvider.handleAlert`, y `sensors` a `useAckAlert.onSettled`; el Plan 5 debe incluir `contract.spec` del handshake y del acuse; todo plan nuevo con una comprobación a 390 px.
