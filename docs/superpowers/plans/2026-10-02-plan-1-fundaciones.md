# Plan 1 — Fundaciones del Frontend (Gemelo Digital 3D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando el monorepo, el contrato tipado del backend, la sesión segura con refresh silencioso, los mocks MSW, el shell con navegación por rol y el home "Estado general" para ADMIN y RESIDENTE, todo probado con Vitest y Playwright.

**Architecture:** Monorepo pnpm + Turborepo. La lógica portable (dominio, cliente API, sesión, hooks de datos) vive en `packages/*` sin APIs del navegador, para reutilizarla en la futura app móvil. `apps/web` es una SPA React + Vite que inyecta los adaptadores del navegador (sessionStorage, fetch, router) y consume esos paquetes. MSW simula el backend con el mismo contrato (schemas Zod) en desarrollo, en tests y en E2E.

**Tech Stack:** Node ≥24, pnpm 10, Turborepo 2, TypeScript 5.9, React 19, Vite 7, React Router 7, TanStack Query 5, Zod 4, MSW 2, Vitest 4, Testing Library, Playwright, axe-core, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-02-gemelo-digital-front-design.md`

### Hoja de ruta de planes

El spec se divide en 5 planes; cada uno produce software funcionando y probado. Este documento es el **Plan 1**. Los siguientes se escriben al terminar el anterior, usando las interfaces reales que este deja.

| Plan | Alcance | Semana |
|---|---|---|
| **1. Fundaciones** (este) | Monorepo, `@gd/domain`, `@gd/api`, `@gd/query`, mocks, sesión, shell, guards, home, E2E base | 1 |
| 2. Alertas y tiempo real | `@gd/realtime`, centro de alertas, acuse optimista, campana, toasts/sonido, indicador de conexión, banner sin conexión | 1–2 |
| 3. Dashboards y series | Estructural, Consumos, Aire, Sensores + `SensorDetailPanel`, `SeriesSource`, downsampling en Worker, ECharts, densidad por zona | 2 |
| 4. Gemelo 3D | `@thatopen/components`, IFC de ejemplo, `twin-mapping.json`, coloreado por estado, deep-links | 3 |
| 5. Mantenimiento, reportes y cierre | Mantenimiento con evidencia, `ProtectedFile`, reportes PDF, CSP, CI, E2E finales | 4 |

### Desviaciones conscientes respecto al spec

- **Zustand no se instala en el Plan 1**: la sesión vive en `SessionManager` (`@gd/api`) + un contexto React; se añade solo si un plan posterior lo necesita.
- **`eslint-plugin-boundaries`** se sustituye por dependencias estrictas de pnpm (un paquete solo importa lo que declara) + `no-restricted-globals` en `packages/*`.
- **Seed de 22 sensores** (spec: "~30"), suficiente para todos los escenarios.
- **Versiones**: se fijan majors anteriores a las últimas publicadas (Vite 8, TS 7, MSW 3, React Router 8 y Vitest 5 ya existen) porque este plan está escrito contra las APIs de Vite 7, TS 5.9, MSW 2, React Router 7 y Vitest 4.

## Global Constraints

- Idioma de la UI: español (Colombia). Nunca usar "diagnóstico", "predicción", "riesgo de colapso" ni prometer más que "detecta y avisa cambios medibles".
- Fechas mostradas en `America/Bogota` con locale `es-CO`; la API recibe y devuelve ISO-8601 UTC.
- El RESIDENTE nunca recibe tipos con campos numéricos de medición (`value_triggered`, `threshold_configured`, `ppm`).
- Solo zonas comunes; nada por apartamento.
- Un sensor sin reporte > 15 min (`OFFLINE_THRESHOLD_MS = 15 * 60 * 1000`) es OFFLINE y nunca se pinta como sano.
- Todo estado se comunica con color + icono + texto.
- `packages/*` no usa `window`, `document`, `localStorage`, `sessionStorage`, `navigator` ni `location`.
- Access token solo en memoria; refresh token y usuario en `sessionStorage` (detrás de `TokenStore`).
- TypeScript `strict` + `noUncheckedIndexedAccess`; prohibido `any` explícito y `dangerouslySetInnerHTML`.
- Servidor de desarrollo en `http://localhost:5173` con `strictPort` (CORS del backend).
- Base de la API: `/api/v1`; errores con forma `{ error: { code, message, details } }`.

## Review Focus

1. **Score fuera de rango** (`health_score` negativo, > 100 o NaN desde el backend): se muestra acotado a 0–100 y la banda queda en "Atención prioritaria", nunca "NaN" ni negativos. → test en Task 2 y Task 13.
2. **`last_seen_at` nulo, malformado o en el futuro**: nulo/malformado = OFFLINE; futuro (desfase de reloj) = no OFFLINE. → test en Task 1.
3. **Parámetro `volver` malicioso** (`//evil.com`, `https://evil.com`, `/\evil.com`): tras el login se ignora y se va a `/`. → test en Task 11.
4. **`expires_in` menor que el margen de refresh** (p. ej. 60 s): no hay bucle de refresh inmediato; se programa a la mitad de la vida del token. → test en Task 6.
5. **`sessionStorage` bloqueado o que lanza** (Safari privado, cuota): la app funciona con memoria y no se rompe. → test en Task 11.

---

## Estructura de archivos

```
gemelo-digital-front/
├─ package.json · pnpm-workspace.yaml · turbo.json · tsconfig.base.json · eslint.config.js · .gitignore · .prettierrc
├─ packages/
│  ├─ domain/src/   levels.ts · time.ts · sensorStatus.ts · healthScore.ts · freshness.ts · format.ts · index.ts (+ *.test.ts)
│  ├─ api/src/      schemas/{common,auth,dashboard,sensors,alerts,maintenance}.ts · errors.ts · http.ts · jwt.ts
│  │                session.ts · endpoints.ts · index.ts · testing/index.ts (+ *.test.ts)
│  └─ query/src/    ApiContext.tsx · keys.ts · intervals.ts · hooks.ts · index.ts (+ hooks.test.tsx)
└─ apps/web/
   ├─ index.html · vite.config.ts · vitest.config.ts · playwright.config.ts · .env.development · .env.api · .env.production
   ├─ e2e/          helpers.ts · auth.spec.ts · home.spec.ts · a11y.spec.ts
   └─ src/
      ├─ main.tsx · vite-env.d.ts
      ├─ app/        config.ts · services.ts · AppProviders.tsx · routes.tsx · errorMessage.ts
      │              session/{SessionStorageTokenStore.ts, SessionProvider.tsx}
      │              guards/{RequireAuth.tsx, RequireRole.tsx}
      │              layout/{AppShell.tsx, Header.tsx, Sidebar.tsx, navItems.ts, *.module.css}
      │              pages/{ForbiddenPage.tsx, NotFoundPage.tsx, SplashScreen.tsx, PendingSection.tsx}
      ├─ features/auth/   LoginPage.tsx · LoginForm.tsx · ReloginModal.tsx · loginErrorMessage.ts · safeRedirect.ts
      ├─ features/home/   HomePage.tsx · HealthScoreCard.tsx · CriticalBanner.tsx · AlertKpis.tsx · SensorKpis.tsx
      │                   CategoryLinks.tsx · healthCopy.ts · *.module.css
      ├─ ui/              tokens.css · statusMeta.ts · StatusBadge.tsx · KpiCard.tsx · DataState.tsx · Button.tsx · useNow.ts
      ├─ mocks/           seed.ts · db.ts · auth.ts · handlers/{auth,dashboard,alerts,sensors,index}.ts · browser.ts · server.ts
      └─ test/            setup.ts · renderApp.tsx
```

---

### Task 1: Monorepo y estado de sensor en `@gd/domain`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`, `.prettierrc`
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`
- Create: `packages/domain/src/levels.ts`, `packages/domain/src/time.ts`, `packages/domain/src/sensorStatus.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/src/levels.test.ts`, `packages/domain/src/sensorStatus.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO'`; `type StatusLevel = AlertLevel | 'OK' | 'OFFLINE'`; `type SensorCategory = 'structural' | 'consumption' | 'comfort'`
  - `mostSevere(levels: readonly AlertLevel[]): AlertLevel | null`; `compareAlertLevel(a: AlertLevel, b: AlertLevel): number` (más severo primero)
  - `parseTimestamp(iso: string | null | undefined): Date | null`
  - `OFFLINE_THRESHOLD_MS = 900_000`; `isOffline(lastSeenAt: string | null, now: Date): boolean`
  - `interface SensorInput { sensor_id: string; zone: string; category: SensorCategory; last_seen_at: string | null }`
  - `interface AlertInput { sensor_id: string; level: AlertLevel; acknowledged: boolean }`
  - `interface SensorStatus { sensorId: string; level: StatusLevel; lastSeenAt: Date | null; zone: string; category: SensorCategory }`
  - `buildSensorStatusMap(sensors: readonly SensorInput[], alerts: readonly AlertInput[], now: Date): Map<string, SensorStatus>`

- [ ] **Step 1: Verificar herramientas**

Run: `node --version; git config user.email`
Expected: `v24.x` o superior y un email. Si no hay email, detenerse y pedir al usuario que configure `git config user.name` / `user.email`.

- [ ] **Step 2: Instalar pnpm**

Run: `npm install -g pnpm@10` y luego `pnpm --version`
Expected: `10.x.y`

- [ ] **Step 3: Crear archivos raíz**

`package.json`:
```json
{
  "name": "gemelo-digital-front",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24", "pnpm": ">=10" },
  "scripts": {
    "dev": "pnpm --filter @gd/web dev",
    "dev:api": "pnpm --filter @gd/web dev:api",
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "eslint .",
    "e2e": "pnpm --filter @gd/web e2e",
    "format": "prettier --write ."
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "outputs": [] },
    "typecheck": { "outputs": [] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  }
}
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/web/public/mockServiceWorker.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Prohibido por política de seguridad.' },
      ],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location'],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/query/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
```

`.gitignore`:
```
node_modules/
dist/
.turbo/
coverage/
playwright-report/
test-results/
*.local
```

`.prettierrc`:
```json
{ "singleQuote": true, "printWidth": 110, "trailingComma": "all" }
```

- [ ] **Step 4: Instalar dependencias raíz y fijar packageManager**

Run:
```
pnpm add -Dw turbo@^2 typescript@~5.9.3 eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react-hooks@^5 prettier@^3
npm pkg set "packageManager=pnpm@$(pnpm --version)"
```
Expected: `node_modules` creado; `package.json` con `"packageManager": "pnpm@10.x.y"` (Turborepo lo exige).

- [ ] **Step 5: Crear el paquete `@gd/domain`**

`packages/domain/package.json`:
```json
{
  "name": "@gd/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" }
}
```

`packages/domain/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

Run: `pnpm --filter @gd/domain add -D vitest@^4 typescript@~5.9.3`

- [ ] **Step 6: Escribir los tests que fallan**

`packages/domain/src/levels.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compareAlertLevel, mostSevere, type AlertLevel } from './levels';

describe('mostSevere', () => {
  it('devuelve null si no hay niveles', () => {
    expect(mostSevere([])).toBeNull();
  });
  it('elige el nivel más severo', () => {
    expect(mostSevere(['INFO', 'CRITICAL', 'WARNING'])).toBe('CRITICAL');
    expect(mostSevere(['INFO', 'WARNING'])).toBe('WARNING');
  });
});

describe('compareAlertLevel', () => {
  it('ordena de más a menos severo', () => {
    const levels: AlertLevel[] = ['INFO', 'CRITICAL', 'WARNING'];
    expect(levels.sort(compareAlertLevel)).toEqual(['CRITICAL', 'WARNING', 'INFO']);
  });
});
```

`packages/domain/src/sensorStatus.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildSensorStatusMap, isOffline, type AlertInput, type SensorInput } from './sensorStatus';

const NOW = new Date('2026-10-02T15:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const sensor = (id: string, lastSeen: string | null): SensorInput => ({
  sensor_id: id,
  zone: 'Lobby Torre 1',
  category: 'structural',
  last_seen_at: lastSeen,
});

describe('isOffline', () => {
  it('es OFFLINE si no reporta hace más de 15 min', () => {
    expect(isOffline(minutesAgo(16), NOW)).toBe(true);
  });
  it('no es OFFLINE exactamente a los 15 min', () => {
    expect(isOffline(minutesAgo(15), NOW)).toBe(false);
  });
  it('es OFFLINE si last_seen_at es null', () => {
    expect(isOffline(null, NOW)).toBe(true);
  });
  it('es OFFLINE si last_seen_at no es una fecha válida', () => {
    expect(isOffline('no-es-fecha', NOW)).toBe(true);
  });
  it('una fecha futura (desfase de reloj) no es OFFLINE', () => {
    expect(isOffline(new Date(NOW.getTime() + 5 * 60_000).toISOString(), NOW)).toBe(false);
  });
});

describe('buildSensorStatusMap', () => {
  it('OFFLINE prevalece sobre alertas abiertas', () => {
    const alerts: AlertInput[] = [{ sensor_id: 's1', level: 'CRITICAL', acknowledged: false }];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(40))], alerts, NOW);
    expect(map.get('s1')?.level).toBe('OFFLINE');
  });
  it('usa el nivel más severo entre alertas no acusadas', () => {
    const alerts: AlertInput[] = [
      { sensor_id: 's1', level: 'INFO', acknowledged: false },
      { sensor_id: 's1', level: 'WARNING', acknowledged: false },
      { sensor_id: 's1', level: 'CRITICAL', acknowledged: true },
    ];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(1))], alerts, NOW);
    expect(map.get('s1')?.level).toBe('WARNING');
  });
  it('es OK si solo tiene alertas acusadas', () => {
    const alerts: AlertInput[] = [{ sensor_id: 's1', level: 'CRITICAL', acknowledged: true }];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(1))], alerts, NOW);
    expect(map.get('s1')).toEqual({
      sensorId: 's1',
      level: 'OK',
      lastSeenAt: new Date(minutesAgo(1)),
      zone: 'Lobby Torre 1',
      category: 'structural',
    });
  });
  it('ignora alertas de sensores desconocidos', () => {
    const alerts: AlertInput[] = [{ sensor_id: 'otro', level: 'CRITICAL', acknowledged: false }];
    const map = buildSensorStatusMap([sensor('s1', minutesAgo(1))], alerts, NOW);
    expect(map.size).toBe(1);
    expect(map.get('s1')?.level).toBe('OK');
  });
});
```

- [ ] **Step 7: Correr los tests y verificar que fallan**

Run: `pnpm --filter @gd/domain test`
Expected: FAIL — `Failed to resolve import "./levels"` / `"./sensorStatus"`.

- [ ] **Step 8: Implementar**

`packages/domain/src/levels.ts`:
```ts
export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';
export type StatusLevel = AlertLevel | 'OK' | 'OFFLINE';
export type SensorCategory = 'structural' | 'consumption' | 'comfort';

const ALERT_SEVERITY: Record<AlertLevel, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };

export function mostSevere(levels: readonly AlertLevel[]): AlertLevel | null {
  let worst: AlertLevel | null = null;
  for (const level of levels) {
    if (worst === null || ALERT_SEVERITY[level] > ALERT_SEVERITY[worst]) worst = level;
  }
  return worst;
}

/** Comparador para `sort`: deja primero el nivel más severo. */
export function compareAlertLevel(a: AlertLevel, b: AlertLevel): number {
  return ALERT_SEVERITY[b] - ALERT_SEVERITY[a];
}
```

`packages/domain/src/time.ts`:
```ts
/** Convierte un ISO-8601 en Date; devuelve null si falta o no es válido. */
export function parseTimestamp(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
```

`packages/domain/src/sensorStatus.ts`:
```ts
import { mostSevere, type AlertLevel, type SensorCategory, type StatusLevel } from './levels';
import { parseTimestamp } from './time';

export const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

export interface SensorInput {
  sensor_id: string;
  zone: string;
  category: SensorCategory;
  last_seen_at: string | null;
}

export interface AlertInput {
  sensor_id: string;
  level: AlertLevel;
  acknowledged: boolean;
}

export interface SensorStatus {
  sensorId: string;
  level: StatusLevel;
  lastSeenAt: Date | null;
  zone: string;
  category: SensorCategory;
}

export function isOffline(lastSeenAt: string | null, now: Date): boolean {
  const seen = parseTimestamp(lastSeenAt);
  if (seen === null) return true;
  return now.getTime() - seen.getTime() > OFFLINE_THRESHOLD_MS;
}

export function buildSensorStatusMap(
  sensors: readonly SensorInput[],
  alerts: readonly AlertInput[],
  now: Date,
): Map<string, SensorStatus> {
  const openLevels = new Map<string, AlertLevel[]>();
  for (const alert of alerts) {
    if (alert.acknowledged) continue;
    const levels = openLevels.get(alert.sensor_id) ?? [];
    levels.push(alert.level);
    openLevels.set(alert.sensor_id, levels);
  }

  const result = new Map<string, SensorStatus>();
  for (const sensor of sensors) {
    const level: StatusLevel = isOffline(sensor.last_seen_at, now)
      ? 'OFFLINE'
      : (mostSevere(openLevels.get(sensor.sensor_id) ?? []) ?? 'OK');
    result.set(sensor.sensor_id, {
      sensorId: sensor.sensor_id,
      level,
      lastSeenAt: parseTimestamp(sensor.last_seen_at),
      zone: sensor.zone,
      category: sensor.category,
    });
  }
  return result;
}
```

`packages/domain/src/index.ts`:
```ts
export * from './levels';
export * from './time';
export * from './sensorStatus';
```

- [ ] **Step 9: Correr tests, typecheck y lint**

Run: `pnpm --filter @gd/domain test; pnpm typecheck; pnpm lint`
Expected: 11 tests PASS; typecheck y lint sin errores.

- [ ] **Step 10: Commit**

```
git add .
git commit -m "chore: monorepo base y estado de sensor en @gd/domain"
```

---

### Task 2: Puntaje de salud y frescura en `@gd/domain`

**Files:**
- Create: `packages/domain/src/healthScore.ts`, `packages/domain/src/freshness.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/healthScore.test.ts`, `packages/domain/src/freshness.test.ts`

**Interfaces:**
- Consumes: `parseTimestamp` (Task 1).
- Produces:
  - `interface HealthInputs { critical: number; warning: number; info: number; offlineSensors: number }`
  - `type DeductionReason = 'CRITICAL' | 'WARNING' | 'INFO' | 'OFFLINE'`; `interface ScoreDeduction { reason: DeductionReason; count: number; points: number }`
  - `DEDUCTION_WEIGHTS: Record<DeductionReason, number>` = `{ CRITICAL: 25, WARNING: 10, INFO: 2, OFFLINE: 5 }`
  - `scoreBreakdown(inputs: HealthInputs): ScoreDeduction[]` (orden: CRITICAL, WARNING, OFFLINE, INFO; omite los que tienen count 0)
  - `type HealthBand = 'GOOD' | 'ATTENTION' | 'PRIORITY'`; `interface HealthBands { good: number; attention: number }`; `DEFAULT_HEALTH_BANDS = { good: 80, attention: 50 }`
  - `healthBand(score: number, bands?: HealthBands): HealthBand`; `clampScore(score: number): number`
  - `ageMs(iso: string | null | undefined, now: Date): number | null`; `isStale(iso: string | null | undefined, now: Date, maxAgeMs: number): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/healthScore.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clampScore, healthBand, scoreBreakdown } from './healthScore';

describe('scoreBreakdown', () => {
  it('lista solo lo que resta puntos, en orden de severidad', () => {
    expect(scoreBreakdown({ critical: 1, warning: 0, info: 2, offlineSensors: 2 })).toEqual([
      { reason: 'CRITICAL', count: 1, points: 25 },
      { reason: 'OFFLINE', count: 2, points: 10 },
      { reason: 'INFO', count: 2, points: 4 },
    ]);
  });
  it('devuelve lista vacía si no hay descuentos', () => {
    expect(scoreBreakdown({ critical: 0, warning: 0, info: 0, offlineSensors: 0 })).toEqual([]);
  });
});

describe('clampScore', () => {
  it('acota entre 0 y 100 y redondea', () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(87.6)).toBe(88);
  });
  it('convierte NaN o infinito en 0', () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('healthBand', () => {
  it('usa las bandas por defecto 80/50', () => {
    expect(healthBand(80)).toBe('GOOD');
    expect(healthBand(79)).toBe('ATTENTION');
    expect(healthBand(50)).toBe('ATTENTION');
    expect(healthBand(49)).toBe('PRIORITY');
  });
  it('acepta bandas configurables', () => {
    expect(healthBand(85, { good: 90, attention: 60 })).toBe('ATTENTION');
  });
  it('un puntaje inválido cae en PRIORITY', () => {
    expect(healthBand(Number.NaN)).toBe('PRIORITY');
  });
});
```

`packages/domain/src/freshness.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ageMs, isStale } from './freshness';

const NOW = new Date('2026-10-02T15:00:00Z');

describe('freshness', () => {
  it('calcula la edad en ms', () => {
    expect(ageMs('2026-10-02T14:59:00Z', NOW)).toBe(60_000);
  });
  it('devuelve null para fechas inválidas', () => {
    expect(ageMs(null, NOW)).toBeNull();
    expect(ageMs('x', NOW)).toBeNull();
  });
  it('isStale compara contra el máximo permitido', () => {
    expect(isStale('2026-10-02T14:59:00Z', NOW, 60_000)).toBe(false);
    expect(isStale('2026-10-02T14:58:59Z', NOW, 60_000)).toBe(true);
  });
  it('un dato sin fecha válida siempre está desactualizado', () => {
    expect(isStale(null, NOW, 60_000)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/domain test`
Expected: FAIL — no se resuelven `./healthScore` ni `./freshness`.

- [ ] **Step 3: Implementar**

`packages/domain/src/healthScore.ts`:
```ts
export interface HealthInputs {
  critical: number;
  warning: number;
  info: number;
  offlineSensors: number;
}

export type DeductionReason = 'CRITICAL' | 'WARNING' | 'INFO' | 'OFFLINE';

export interface ScoreDeduction {
  reason: DeductionReason;
  count: number;
  points: number;
}

/** Pesos de la fórmula del backend: 100 − (25·crít + 10·adv + 2·info + 5·offline). */
export const DEDUCTION_WEIGHTS: Record<DeductionReason, number> = {
  CRITICAL: 25,
  WARNING: 10,
  INFO: 2,
  OFFLINE: 5,
};

export function scoreBreakdown(inputs: HealthInputs): ScoreDeduction[] {
  const counts: [DeductionReason, number][] = [
    ['CRITICAL', inputs.critical],
    ['WARNING', inputs.warning],
    ['OFFLINE', inputs.offlineSensors],
    ['INFO', inputs.info],
  ];
  return counts
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count, points: count * DEDUCTION_WEIGHTS[reason] }));
}

export type HealthBand = 'GOOD' | 'ATTENTION' | 'PRIORITY';

export interface HealthBands {
  good: number;
  attention: number;
}

/** Propuesta inicial; pendiente de validar con negocio (ver spec §6.1). */
export const DEFAULT_HEALTH_BANDS: HealthBands = { good: 80, attention: 50 };

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function healthBand(score: number, bands: HealthBands = DEFAULT_HEALTH_BANDS): HealthBand {
  const value = clampScore(score);
  if (value >= bands.good) return 'GOOD';
  if (value >= bands.attention) return 'ATTENTION';
  return 'PRIORITY';
}
```

`packages/domain/src/freshness.ts`:
```ts
import { parseTimestamp } from './time';

export function ageMs(iso: string | null | undefined, now: Date): number | null {
  const date = parseTimestamp(iso);
  return date ? now.getTime() - date.getTime() : null;
}

export function isStale(iso: string | null | undefined, now: Date, maxAgeMs: number): boolean {
  const age = ageMs(iso, now);
  return age === null || age > maxAgeMs;
}
```

Añadir a `packages/domain/src/index.ts`:
```ts
export * from './healthScore';
export * from './freshness';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/domain test`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```
git add packages/domain
git commit -m "feat(domain): puntaje de salud con desglose, bandas y frescura"
```

---

### Task 3: Formato es-CO y zona horaria America/Bogota

**Files:**
- Create: `packages/domain/src/format.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/format.test.ts`

**Interfaces:**
- Consumes: `parseTimestamp` (Task 1).
- Produces:
  - `LOCALE = 'es-CO'`, `TIME_ZONE = 'America/Bogota'`, `EMPTY_VALUE = '—'`
  - `formatNumber(value: number | null | undefined, maximumFractionDigits?: number): string`
  - `formatDateTime(iso: string | null | undefined): string`
  - `formatTime(iso: string | null | undefined): string`
  - `formatRelative(iso: string | null | undefined, now: Date): string` (`'justo ahora'` si < 60 s o en el futuro)

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_VALUE, formatDateTime, formatNumber, formatRelative, formatTime } from './format';

/** Intl usa espacios especiales (U+00A0, U+202F); se normalizan para comparar. */
const n = (s: string) => s.replace(/\s/g, ' ');
const NOW = new Date('2026-10-02T20:45:00Z');

describe('formatNumber', () => {
  it('usa punto de miles y coma decimal', () => {
    expect(n(formatNumber(12345.67))).toBe('12.345,7');
  });
  it('respeta los decimales pedidos', () => {
    expect(n(formatNumber(0.3456, 2))).toBe('0,35');
  });
  it('muestra guion para valores ausentes o no finitos', () => {
    expect(formatNumber(null)).toBe(EMPTY_VALUE);
    expect(formatNumber(undefined)).toBe(EMPTY_VALUE);
    expect(formatNumber(Number.NaN)).toBe(EMPTY_VALUE);
  });
});

describe('formatDateTime / formatTime', () => {
  it('convierte UTC a hora de Bogotá (UTC−5)', () => {
    expect(n(formatDateTime('2026-10-02T20:45:00Z'))).toMatch(/2 (de )?oct\.? (de )?2026,? 3:45 p\. ?m\./);
    expect(n(formatTime('2026-10-02T20:45:00Z'))).toMatch(/^3:45 p\. ?m\.$/);
  });
  it('cruza el día correctamente (UTC 03:00 = 10:00 p. m. del día anterior)', () => {
    expect(n(formatDateTime('2026-10-03T03:00:00Z'))).toMatch(/^2 (de )?oct/);
  });
  it('muestra guion para fechas inválidas', () => {
    expect(formatDateTime('x')).toBe(EMPTY_VALUE);
    expect(formatTime(null)).toBe(EMPTY_VALUE);
  });
});

describe('formatRelative', () => {
  it('"justo ahora" por debajo de un minuto o en el futuro', () => {
    expect(formatRelative('2026-10-02T20:44:30Z', NOW)).toBe('justo ahora');
    expect(formatRelative('2026-10-02T20:50:00Z', NOW)).toBe('justo ahora');
  });
  it('minutos, horas y días', () => {
    expect(n(formatRelative('2026-10-02T20:40:00Z', NOW))).toMatch(/^hace 5 min/);
    expect(n(formatRelative('2026-10-02T18:45:00Z', NOW))).toMatch(/^hace 2 h/);
    expect(n(formatRelative('2026-09-29T20:45:00Z', NOW))).toMatch(/^hace 3 d/);
  });
  it('guion para fechas inválidas', () => {
    expect(formatRelative(null, NOW)).toBe(EMPTY_VALUE);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/domain test`
Expected: FAIL — no se resuelve `./format`.

- [ ] **Step 3: Implementar**

`packages/domain/src/format.ts`:
```ts
import { parseTimestamp } from './time';

export const LOCALE = 'es-CO';
export const TIME_ZONE = 'America/Bogota';
export const EMPTY_VALUE = '—';

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always', style: 'short' });

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value);
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parseTimestamp(iso);
  return date ? dateTimeFormat.format(date) : EMPTY_VALUE;
}

export function formatTime(iso: string | null | undefined): string {
  const date = parseTimestamp(iso);
  return date ? timeFormat.format(date) : EMPTY_VALUE;
}

export function formatRelative(iso: string | null | undefined, now: Date): string {
  const date = parseTimestamp(iso);
  if (!date) return EMPTY_VALUE;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'justo ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativeFormat.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeFormat.format(-hours, 'hour');
  return relativeFormat.format(-Math.floor(hours / 24), 'day');
}
```

Añadir a `packages/domain/src/index.ts`:
```ts
export * from './format';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/domain test`
Expected: PASS. Si una aserción de Intl falla solo por la forma exacta del texto (p. ej. "oct." vs "oct"), ajustar la regex del test a la salida real de Node 24 **sin** cambiar la implementación, y anotarlo en el commit.

- [ ] **Step 5: Commit**

```
git add packages/domain
git commit -m "feat(domain): formato es-CO y hora de Bogotá"
```

---

### Task 4: Contrato del backend como schemas Zod + modelo de errores (`@gd/api`)

**Files:**
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`
- Create: `packages/api/src/schemas/common.ts`, `auth.ts`, `dashboard.ts`, `sensors.ts`, `alerts.ts`, `maintenance.ts`
- Create: `packages/api/src/errors.ts`, `packages/api/src/index.ts`
- Test: `packages/api/src/schemas/schemas.test.ts`, `packages/api/src/errors.test.ts`

**Interfaces:**
- Consumes: nada (los enums replican los de `@gd/domain` con la misma forma literal).
- Produces:
  - Schemas: `roleSchema`, `alertLevelSchema`, `sensorCategorySchema`, `idSchema`, `errorEnvelopeSchema`, `listOf(item)`, `sessionUserSchema`, `loginResponseSchema`, `refreshResponseSchema`, `dashboardGeneralSchema`, `dashboardStructuralSchema`, `dashboardConsumptionSchema`, `comfortIndexSchema`, `comfortAdminSchema`, `comfortResidenteSchema`, `sensorSchema`, `sensorListSchema`, `readingSchema`, `readingListSchema`, `alertResidenteSchema`, `alertAdminSchema`, `alertListResidenteSchema`, `alertListAdminSchema`, `maintenanceStatusSchema`, `maintenanceTaskSchema`, `maintenanceListSchema`
  - Tipos: `Role`, `SessionUser`, `LoginResponse`, `RefreshResponse`, `DashboardGeneral`, `DashboardStructural`, `DashboardConsumption`, `ComfortAdmin`, `ComfortResidente`, `Sensor`, `SensorList`, `Reading`, `AlertResidente`, `AlertAdmin`, `AlertListResidente`, `AlertListAdmin`, `MaintenanceStatus`, `MaintenanceTask`
  - `interface FieldError { path: string; message: string }`
  - `class ApiError extends Error { status: number; code: string; details: unknown; retryAfterSeconds: number | null; get fieldErrors(): FieldError[] }` con `constructor(init: { status: number; code: string; message: string; details?: unknown; retryAfterSeconds?: number | null })`
  - `interface ContractDrift { method: string; path: string; issues: string[] }`; `class ContractDriftError extends Error { drift: ContractDrift }`
  - `apiErrorFromResponse(response: Response): Promise<ApiError>`; `networkError(cause: unknown): ApiError`

- [ ] **Step 1: Crear el paquete**

`packages/api/package.json`:
```json
{
  "name": "@gd/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" }
}
```

`packages/api/tsconfig.json` (DOM solo por los tipos de `fetch`/`Response`; el lint impide usar globales del navegador):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023", "DOM"] },
  "include": ["src"]
}
```

Run: `pnpm --filter @gd/api add zod@^4; pnpm --filter @gd/api add -D vitest@^4 typescript@~5.9.3`

- [ ] **Step 2: Escribir los tests que fallan**

`packages/api/src/schemas/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { alertAdminSchema, alertResidenteSchema } from './alerts';
import { loginResponseSchema } from './auth';
import { listOf } from './common';
import { comfortResidenteSchema, dashboardStructuralSchema } from './dashboard';
import { readingSchema } from './sensors';

const adminAlert = {
  alert_id: 'alrt-20261002-00001',
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

describe('schemas del contrato', () => {
  it('acepta la respuesta de login', () => {
    const parsed = loginResponseSchema.parse({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: 7, email: 'admin@demo.co', role: 'ADMIN', name: 'Admin' },
    });
    expect(parsed.user.id).toBe('7');
  });

  it('el schema de residente descarta los campos numéricos aunque vengan', () => {
    const parsed = alertResidenteSchema.parse(adminAlert);
    expect(parsed).not.toHaveProperty('value_triggered');
    expect(parsed).not.toHaveProperty('threshold_configured');
    expect(parsed).not.toHaveProperty('occurrence_count');
  });

  it('el schema de admin exige occurrence_count (detecta deriva)', () => {
    const withoutCount: Record<string, unknown> = { ...adminAlert };
    delete withoutCount.occurrence_count;
    expect(alertAdminSchema.safeParse(withoutCount).success).toBe(false);
  });

  it('el confort de residente descarta ppm', () => {
    const parsed = comfortResidenteSchema.parse({ zones: [{ zone: 'Gimnasio', index: 'BUENO', sensors: 1, ppm: 650 }] });
    expect(parsed.zones[0]).not.toHaveProperty('ppm');
  });

  it('alerts en estructural acepta un número o una lista y lo normaliza a número', () => {
    const parsed = dashboardStructuralSchema.parse({
      structural_score: 80,
      sensors_in_alert: [
        { sensor_id: 'a', level: 'WARNING', alerts: 2 },
        { sensor_id: 'b', level: 'CRITICAL', alerts: [{}, {}, {}] },
      ],
    });
    expect(parsed.sensors_in_alert.map((s) => s.alerts)).toEqual([2, 3]);
  });

  it('listOf acepta un arreglo o un objeto { data }', () => {
    const schema = listOf(readingSchema);
    const reading = { timestamp: '2026-10-02T15:00:00Z', unit: 'g', values: { x: 0.1 }, battery_pct: 90 };
    expect(schema.parse([reading])).toHaveLength(1);
    expect(schema.parse({ count: 1, data: [reading] })).toHaveLength(1);
  });
});
```

`packages/api/src/errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFromResponse, networkError } from './errors';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('apiErrorFromResponse', () => {
  it('lee el sobre { error: { code, message, details } }', async () => {
    const err = await apiErrorFromResponse(
      json(422, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          details: [{ path: ['description'], message: 'Mínimo 3 caracteres' }],
        },
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fieldErrors).toEqual([{ path: 'description', message: 'Mínimo 3 caracteres' }]);
  });

  it('lee Retry-After en segundos', async () => {
    const err = await apiErrorFromResponse(
      json(429, { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes' } }, { 'Retry-After': '30' }),
    );
    expect(err.retryAfterSeconds).toBe(30);
  });

  it('tolera cuerpos que no siguen el contrato', async () => {
    const err = await apiErrorFromResponse(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    expect(err.code).toBe('HTTP_502');
    expect(err.fieldErrors).toEqual([]);
  });
});

describe('networkError', () => {
  it('usa status 0 y NETWORK_ERROR', () => {
    const err = networkError(new TypeError('Failed to fetch'));
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `pnpm --filter @gd/api test`
Expected: FAIL — no se resuelven los módulos.

- [ ] **Step 4: Implementar los schemas**

`packages/api/src/schemas/common.ts`:
```ts
import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'RESIDENTE']);
export type Role = z.infer<typeof roleSchema>;

export const alertLevelSchema = z.enum(['CRITICAL', 'WARNING', 'INFO']);
export const sensorCategorySchema = z.enum(['structural', 'consumption', 'comfort']);

/** Identificadores que el backend podría enviar como número o texto; se normalizan a texto. */
export const idSchema = z.union([z.string(), z.number()]).transform(String);

export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

/** Listas cuya forma exacta no está fijada en el contrato: arreglo plano u objeto { data }. */
export function listOf<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), z.object({ data: z.array(item) })])
    .transform((value) => (Array.isArray(value) ? value : value.data));
}
```

`packages/api/src/schemas/auth.ts`:
```ts
import { z } from 'zod';
import { idSchema, roleSchema } from './common';

/** El contrato no fija los campos de `user`; se exige lo mínimo y se conserva el resto. */
export const sessionUserSchema = z.looseObject({
  id: idSchema.optional(),
  email: z.string(),
  name: z.string().nullish(),
  role: roleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

const tokenFields = {
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().positive(),
};

export const loginResponseSchema = z.object({ ...tokenFields, user: sessionUserSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({ ...tokenFields, user: sessionUserSchema.optional() });
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
```

`packages/api/src/schemas/dashboard.ts`:
```ts
import { z } from 'zod';
import { alertLevelSchema } from './common';

const count = z.number().int().nonnegative();

export const dashboardGeneralSchema = z.object({
  health_score: z.number(),
  alerts_summary: z.object({ CRITICAL: count, WARNING: count, INFO: count, total: count }),
  sensors: z.object({ total: count, online: count, offline: count }),
  generated_at: z.string(),
});
export type DashboardGeneral = z.infer<typeof dashboardGeneralSchema>;

/** `alerts` es ambiguo en el contrato (conteo o lista); se normaliza a conteo. */
const alertCount = z.union([count, z.array(z.unknown()).transform((list) => list.length)]);

export const dashboardStructuralSchema = z.object({
  structural_score: z.number(),
  sensors_in_alert: z.array(z.object({ sensor_id: z.string(), level: alertLevelSchema, alerts: alertCount })),
});
export type DashboardStructural = z.infer<typeof dashboardStructuralSchema>;

export const dashboardConsumptionSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  by_unit: z.array(
    z.object({
      unit: z.string(),
      current_period: z.number(),
      previous_period: z.number().nullable(),
      variation_pct: z.number().nullable(),
    }),
  ),
});
export type DashboardConsumption = z.infer<typeof dashboardConsumptionSchema>;

export const comfortIndexSchema = z.enum(['BUENO', 'REGULAR', 'MALO']);

const comfortZoneBase = {
  zone: z.string(),
  index: comfortIndexSchema,
  sensors: z.union([count, z.array(z.string())]),
};

export const comfortResidenteSchema = z.object({ zones: z.array(z.object(comfortZoneBase)) });
export type ComfortResidente = z.infer<typeof comfortResidenteSchema>;

export const comfortAdminSchema = z.object({
  zones: z.array(z.object({ ...comfortZoneBase, ppm: z.number().nullable().optional() })),
});
export type ComfortAdmin = z.infer<typeof comfortAdminSchema>;
```

`packages/api/src/schemas/sensors.ts`:
```ts
import { z } from 'zod';
import { listOf, sensorCategorySchema } from './common';

export const sensorSchema = z.object({
  sensor_id: z.string(),
  name: z.string(),
  sensor_type: z.string(),
  category: sensorCategorySchema,
  zone: z.string(),
  unit: z.string().nullable(),
  status: z.string(),
  last_values: z.record(z.string(), z.number().nullable()).nullable(),
  last_battery_pct: z.number().nullable(),
  firmware_version: z.string().nullable(),
  last_seen_at: z.string().nullable(),
});
export type Sensor = z.infer<typeof sensorSchema>;

export const sensorListSchema = z.object({ count: z.number().int(), data: z.array(sensorSchema) });
export type SensorList = z.infer<typeof sensorListSchema>;

export const readingSchema = z.object({
  timestamp: z.string(),
  unit: z.string().nullable(),
  values: z.record(z.string(), z.number().nullable()),
  battery_pct: z.number().nullable(),
});
export type Reading = z.infer<typeof readingSchema>;

export const readingListSchema = listOf(readingSchema);
```

`packages/api/src/schemas/alerts.ts`:
```ts
import { z } from 'zod';
import { alertLevelSchema, idSchema } from './common';

/** Forma que recibe el RESIDENTE: sin valores numéricos. z.object descarta claves desconocidas. */
export const alertResidenteSchema = z.object({
  alert_id: z.string(),
  building_id: idSchema,
  sensor_id: z.string(),
  level: alertLevelSchema,
  category: z.string(),
  message: z.string(),
  timestamp: z.string(),
  acknowledged: z.boolean(),
});
export type AlertResidente = z.infer<typeof alertResidenteSchema>;

export const alertAdminSchema = alertResidenteSchema.extend({
  value_triggered: z.number().nullable(),
  threshold_configured: z.number().nullable(),
  occurrence_count: z.number().int().positive(),
  acknowledged_by: z.string().nullable(),
  acknowledged_at: z.string().nullable(),
});
export type AlertAdmin = z.infer<typeof alertAdminSchema>;

export const alertListResidenteSchema = z.object({ count: z.number().int(), data: z.array(alertResidenteSchema) });
export type AlertListResidente = z.infer<typeof alertListResidenteSchema>;

export const alertListAdminSchema = z.object({ count: z.number().int(), data: z.array(alertAdminSchema) });
export type AlertListAdmin = z.infer<typeof alertListAdminSchema>;
```

`packages/api/src/schemas/maintenance.ts`:
```ts
import { z } from 'zod';
import { idSchema, listOf } from './common';

export const maintenanceStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'DONE']);
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

export const maintenanceTaskSchema = z.object({
  id: idSchema,
  description: z.string(),
  status: maintenanceStatusSchema,
  due_date: z.string().nullish(),
  completed_at: z.string().nullish(),
  completed_by: z.string().nullish(),
  evidence_url: z.string().nullish(),
});
export type MaintenanceTask = z.infer<typeof maintenanceTaskSchema>;

export const maintenanceListSchema = listOf(maintenanceTaskSchema);
```

- [ ] **Step 5: Implementar los errores**

`packages/api/src/errors.ts`:
```ts
import { errorEnvelopeSchema } from './schemas/common';

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  retryAfterSeconds?: number | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  /** Errores por campo de un 422 VALIDATION_ERROR (`details: [{ path, message }]`). */
  get fieldErrors(): FieldError[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.flatMap((detail: unknown) => {
      if (typeof detail !== 'object' || detail === null) return [];
      const { path, message } = detail as { path?: unknown; message?: unknown };
      if (typeof message !== 'string') return [];
      const joined = Array.isArray(path) ? path.map(String).join('.') : typeof path === 'string' ? path : '';
      return [{ path: joined, message }];
    });
  }
}

export interface ContractDrift {
  method: string;
  path: string;
  issues: string[];
}

export class ContractDriftError extends Error {
  readonly drift: ContractDrift;

  constructor(drift: ContractDrift) {
    super(`Respuesta fuera de contrato en ${drift.method} ${drift.path}`);
    this.name = 'ContractDriftError';
    this.drift = drift;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    return new ApiError({
      status: response.status,
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details ?? null,
      retryAfterSeconds,
    });
  }
  return new ApiError({
    status: response.status,
    code: `HTTP_${response.status}`,
    message: response.statusText || 'Error desconocido',
    retryAfterSeconds,
  });
}

export function networkError(cause: unknown): ApiError {
  return new ApiError({
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'No se pudo conectar con el servidor',
    details: cause instanceof Error ? cause.message : null,
  });
}
```

`packages/api/src/index.ts`:
```ts
export * from './schemas/common';
export * from './schemas/auth';
export * from './schemas/dashboard';
export * from './schemas/sensors';
export * from './schemas/alerts';
export * from './schemas/maintenance';
export * from './errors';
```

- [ ] **Step 6: Correr y verificar que pasan**

Run: `pnpm --filter @gd/api test; pnpm --filter @gd/api typecheck`
Expected: PASS; sin errores de tipos.

- [ ] **Step 7: Commit**

```
git add packages/api pnpm-lock.yaml
git commit -m "feat(api): contrato del backend en Zod y modelo de errores"
```

---

### Task 5: Cliente HTTP con validación de contrato y reintento tras 401

**Files:**
- Create: `packages/api/src/http.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/src/http.test.ts`

**Interfaces:**
- Consumes: `ApiError`, `ContractDriftError`, `ContractDrift`, `apiErrorFromResponse`, `networkError` (Task 4).
- Produces:
  - `API_PREFIX = '/api/v1'`; `type ValidationMode = 'strict' | 'lenient'`; `type QueryParams = Record<string, string | number | boolean | null | undefined>`
  - `buildUrl(baseUrl: string, path: string, query?: QueryParams): string` (omite `null`, `undefined` y `''`)
  - `interface HttpClientOptions { baseUrl: string; getAccessToken(): string | null; refreshAccessToken(): Promise<boolean>; waitForReauth?(): Promise<boolean>; validation: ValidationMode; onContractDrift?(drift: ContractDrift): void; fetch?: typeof fetch }`
  - `interface GetOptions<S extends z.ZodType> { schema: S; query?: QueryParams; signal?: AbortSignal }`; `interface PostOptions<S> extends GetOptions<S> { body?: unknown }`
  - `interface HttpClient { get<S>(path, options: GetOptions<S>): Promise<z.output<S>>; post<S>(path, options: PostOptions<S>): Promise<z.output<S>>; getBlob(path, options?: { query?: QueryParams; signal?: AbortSignal }): Promise<Blob> }`
  - `createHttpClient(options: HttpClientOptions): HttpClient`
  - Comportamiento ante 401: llama `refreshAccessToken()`; si devuelve `false` y existe `waitForReauth`, espera ese resultado; si alguno es `true`, reintenta **una sola vez**.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/api/src/http.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, ContractDriftError } from './errors';
import { buildUrl, createHttpClient, type HttpClientOptions } from './http';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const okSchema = z.object({ ok: z.boolean() });

function setup(responses: Response[], overrides: Partial<HttpClientOptions> = {}) {
  let token = 'token-1';
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error('sin respuesta preparada');
    return next;
  });
  const refreshAccessToken = vi.fn(async () => {
    token = 'token-2';
    return true;
  });
  const client = createHttpClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => token,
    refreshAccessToken,
    validation: 'strict',
    fetch: fetchMock as unknown as typeof fetch,
    ...overrides,
  });
  const authHeader = (call: number) =>
    (fetchMock.mock.calls[call]?.[1]?.headers as Record<string, string> | undefined)?.Authorization;
  return { client, fetchMock, refreshAccessToken, authHeader };
}

describe('buildUrl', () => {
  it('antepone /api/v1 y omite parámetros vacíos', () => {
    expect(buildUrl('http://api.test', '/alerts', { level: 'CRITICAL', acknowledged: false, x: null, y: undefined, z: '' })).toBe(
      'http://api.test/api/v1/alerts?level=CRITICAL&acknowledged=false',
    );
  });
});

describe('createHttpClient', () => {
  it('envía el Bearer y valida la respuesta', async () => {
    const { client, authHeader } = setup([json(200, { ok: true })]);
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: true });
    expect(authHeader(0)).toBe('Bearer token-1');
  });

  it('ante 401 renueva el token y reintenta una vez', async () => {
    const { client, refreshAccessToken, authHeader } = setup([json(401, {}), json(200, { ok: true })]);
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authHeader(1)).toBe('Bearer token-2');
  });

  it('no entra en bucle: un segundo 401 se propaga', async () => {
    const { client, refreshAccessToken } = setup([json(401, {}), json(401, {})]);
    await expect(client.get('/x', { schema: okSchema })).rejects.toMatchObject({ status: 401 });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('si el refresh falla espera la re-autenticación y reintenta', async () => {
    const waitForReauth = vi.fn(async () => true);
    const { client } = setup([json(401, {}), json(200, { ok: true })], {
      refreshAccessToken: async () => false,
      waitForReauth,
    });
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: true });
    expect(waitForReauth).toHaveBeenCalledTimes(1);
  });

  it('si no hay re-autenticación propaga el 401', async () => {
    const { client } = setup([json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expiró' } })], {
      refreshAccessToken: async () => false,
      waitForReauth: async () => false,
    });
    await expect(client.get('/x', { schema: okSchema })).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
  });

  it('convierte 422 en ApiError con errores por campo', async () => {
    const { client } = setup([
      json(422, { error: { code: 'VALIDATION_ERROR', message: 'x', details: [{ path: 'description', message: 'corta' }] } }),
    ]);
    const err = await client.post('/maintenance', { schema: okSchema, body: { description: 'a' } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fieldErrors).toEqual([{ path: 'description', message: 'corta' }]);
  });

  it('envía el cuerpo como JSON en POST', async () => {
    const { client, fetchMock } = setup([json(200, { ok: true })]);
    await client.post('/x', { schema: okSchema, body: { a: 1 } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('modo strict: una respuesta fuera de contrato lanza ContractDriftError y la reporta', async () => {
    const onContractDrift = vi.fn();
    const { client } = setup([json(200, { ok: 'sí' })], { onContractDrift });
    await expect(client.get('/x', { schema: okSchema })).rejects.toBeInstanceOf(ContractDriftError);
    expect(onContractDrift).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', path: '/x' }));
  });

  it('modo lenient: reporta la deriva pero devuelve los datos', async () => {
    const onContractDrift = vi.fn();
    const { client } = setup([json(200, { ok: 'sí' })], { validation: 'lenient', onContractDrift });
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: 'sí' });
    expect(onContractDrift).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red se convierte en ApiError status 0', async () => {
    const client = createHttpClient({
      baseUrl: '',
      getAccessToken: () => null,
      refreshAccessToken: async () => false,
      validation: 'strict',
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    await expect(client.get('/x', { schema: okSchema })).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('getBlob devuelve el binario', async () => {
    const { client } = setup([new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } })]);
    const blob = await client.getBlob('/reports/structural_health');
    expect(await blob.text()).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/api test`
Expected: FAIL — no se resuelve `./http`.

- [ ] **Step 3: Implementar**

`packages/api/src/http.ts`:
```ts
import type { z } from 'zod';
import { ApiError, ContractDriftError, apiErrorFromResponse, networkError, type ContractDrift } from './errors';

export const API_PREFIX = '/api/v1';

export type ValidationMode = 'strict' | 'lenient';
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface HttpClientOptions {
  /** Origen del backend; '' para rutas relativas (modo mock en el navegador). */
  baseUrl: string;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
  /** Se usa si el refresh falla: resuelve true cuando el mismo usuario vuelve a iniciar sesión. */
  waitForReauth?: () => Promise<boolean>;
  validation: ValidationMode;
  onContractDrift?: (drift: ContractDrift) => void;
  fetch?: typeof fetch;
}

export interface GetOptions<S extends z.ZodType> {
  schema: S;
  query?: QueryParams;
  signal?: AbortSignal;
}

export interface PostOptions<S extends z.ZodType> extends GetOptions<S> {
  body?: unknown;
}

export interface HttpClient {
  get<S extends z.ZodType>(path: string, options: GetOptions<S>): Promise<z.output<S>>;
  post<S extends z.ZodType>(path: string, options: PostOptions<S>): Promise<z.output<S>>;
  getBlob(path: string, options?: { query?: QueryParams; signal?: AbortSignal }): Promise<Blob>;
}

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${API_PREFIX}${path}${search ? `?${search}` : ''}`;
}

interface SendInit {
  method: 'GET' | 'POST';
  accept: string;
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function send(path: string, init: SendInit, retried = false): Promise<Response> {
    const headers: Record<string, string> = { Accept: init.accept };
    const token = options.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: string | undefined;
    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }

    let response: Response;
    try {
      response = await doFetch(buildUrl(options.baseUrl, path, init.query), {
        method: init.method,
        headers,
        body,
        signal: init.signal,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw networkError(error);
    }

    if (response.status === 401 && !retried) {
      let renewed = await options.refreshAccessToken();
      if (!renewed && options.waitForReauth) renewed = await options.waitForReauth();
      if (renewed) return send(path, init, true);
    }
    if (!response.ok) throw await apiErrorFromResponse(response);
    return response;
  }

  async function parse<S extends z.ZodType>(
    response: Response,
    schema: S,
    method: string,
    path: string,
  ): Promise<z.output<S>> {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_JSON',
        message: 'La respuesta del servidor no es JSON válido',
      });
    }
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    const drift: ContractDrift = {
      method,
      path,
      issues: result.error.issues.map((issue) => `${issue.path.map(String).join('.') || '(raíz)'}: ${issue.message}`),
    };
    options.onContractDrift?.(drift);
    if (options.validation === 'strict') throw new ContractDriftError(drift);
    return data as z.output<S>;
  }

  return {
    async get(path, { schema, query, signal }) {
      const response = await send(path, { method: 'GET', accept: 'application/json', query, signal });
      return parse(response, schema, 'GET', path);
    },
    async post(path, { schema, query, signal, body }) {
      const response = await send(path, { method: 'POST', accept: 'application/json', query, signal, body });
      return parse(response, schema, 'POST', path);
    },
    async getBlob(path, blobOptions = {}) {
      const response = await send(path, {
        method: 'GET',
        accept: '*/*',
        query: blobOptions.query,
        signal: blobOptions.signal,
      });
      return response.blob();
    },
  };
}
```

Añadir a `packages/api/src/index.ts`:
```ts
export * from './http';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/api test; pnpm --filter @gd/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add packages/api
git commit -m "feat(api): cliente HTTP con validación de contrato y reintento tras 401"
```

---

### Task 6: Gestor de sesión (login, refresh de vuelo único, re-autenticación, logout)

**Files:**
- Create: `packages/api/src/jwt.ts`, `packages/api/src/session.ts`, `packages/api/src/testing/index.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/src/session.test.ts`

**Interfaces:**
- Consumes: `loginResponseSchema`, `refreshResponseSchema`, `sessionUserSchema`, `roleSchema`, `idSchema`, `SessionUser`, `Role` (Task 4); `API_PREFIX` (Task 5); `ApiError`, `apiErrorFromResponse`, `networkError` (Task 4).
- Produces:
  - `decodeJwtPayload(token: string): unknown` (lanza si es inválido)
  - `interface TokenStore { getRefreshToken(): string | null; setRefreshToken(token: string | null): void; getUser(): SessionUser | null; setUser(user: SessionUser | null): void }`; `class MemoryTokenStore implements TokenStore`
  - `interface SessionClaims { sub: string; role: Role; buildingId: string }`; `decodeClaims(accessToken: string): SessionClaims`
  - `interface Session { accessToken: string; claims: SessionClaims; user: SessionUser | null }`
  - `type SessionEndReason = 'logout' | 'expired'`; `type SessionListener = (session: Session | null, reason?: SessionEndReason) => void`
  - `interface Scheduler { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }`
  - `REFRESH_MARGIN_SECONDS = 120`; `refreshDelayMs(expiresInSeconds: number): number`
  - `interface SessionManagerOptions { baseUrl: string; store: TokenStore; fetch?: typeof fetch; scheduler?: Scheduler }`
  - `interface SessionManager { getAccessToken(): string | null; getSession(): Session | null; login(email: string, password: string): Promise<Session>; restore(): Promise<Session | null>; refresh(): Promise<boolean>; waitForReauth(): Promise<boolean>; logout(): Promise<void>; subscribe(listener: SessionListener): () => void }`
  - `createSessionManager(options: SessionManagerOptions): SessionManager`
  - `@gd/api/testing`: `makeFakeJwt(payload: Record<string, unknown>): string`, `readFakeJwt(token: string): Record<string, unknown> | null`

- [ ] **Step 1: Escribir los tests que fallan**

`packages/api/src/session.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { MemoryTokenStore, createSessionManager, refreshDelayMs, type Scheduler } from './session';
import { makeFakeJwt } from './testing';

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

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function tokens(n: number, sub = 'usr-1', expiresIn = 900) {
  return {
    access_token: makeFakeJwt({ sub, role: 'ADMIN', buildingId: 'bld-1', n }),
    refresh_token: `r-${n}`,
    token_type: 'Bearer',
    expires_in: expiresIn,
  };
}
const user = { id: 'usr-1', email: 'admin@demo.co', name: 'Admin', role: 'ADMIN' as const };

function setup(handler: (url: string, body: Record<string, unknown>) => Response | Promise<Response>) {
  const store = new MemoryTokenStore();
  const scheduler = new FakeScheduler();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>),
  );
  const manager = createSessionManager({
    baseUrl: 'http://api.test',
    store,
    scheduler,
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { manager, store, scheduler, fetchMock };
}

describe('refreshDelayMs', () => {
  it('renueva 120 s antes de expirar', () => {
    expect(refreshDelayMs(900)).toBe(780_000);
  });
  it('con tokens muy cortos usa la mitad de la vida (sin bucle inmediato)', () => {
    expect(refreshDelayMs(60)).toBe(30_000);
    expect(refreshDelayMs(5)).toBe(2_500);
  });
});

describe('createSessionManager', () => {
  it('login guarda refresh y usuario, decodifica claims y programa el refresh', async () => {
    const { manager, store, scheduler } = setup(() => json(200, { ...tokens(1), user }));
    const session = await manager.login('admin@demo.co', 'x');
    expect(session.claims).toEqual({ sub: 'usr-1', role: 'ADMIN', buildingId: 'bld-1' });
    expect(manager.getAccessToken()).toBe(session.accessToken);
    expect(store.getRefreshToken()).toBe('r-1');
    expect(store.getUser()?.email).toBe('admin@demo.co');
    expect(scheduler.tasks.map((t) => t.ms)).toEqual([780_000]);
  });

  it('login fallido lanza ApiError con el código del backend', async () => {
    const { manager } = setup(() => json(423, { error: { code: 'ACCOUNT_LOCKED', message: 'bloqueada' } }));
    const err = await manager.login('a@b.co', 'x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 423, code: 'ACCOUNT_LOCKED' });
  });

  it('refresh es de vuelo único: dos llamadas simultáneas hacen un solo POST', async () => {
    let n = 1;
    const { manager, store, fetchMock } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : json(200, tokens(++n)),
    );
    await manager.login('admin@demo.co', 'x');
    const [a, b] = await Promise.all([manager.refresh(), manager.refresh()]);
    expect(a && b).toBe(true);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(1);
    expect(store.getRefreshToken()).toBe('r-2');
  });

  it('refresh rechazado cierra la sesión con motivo "expired"', async () => {
    const { manager, store } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : json(401, { error: { code: 'X', message: 'x' } }),
    );
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    await expect(manager.refresh()).resolves.toBe(false);
    expect(manager.getSession()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null, 'expired');
  });

  it('un fallo de red en el refresh conserva la sesión', async () => {
    const { manager } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      throw new TypeError('Failed to fetch');
    });
    await manager.login('admin@demo.co', 'x');
    await expect(manager.refresh()).resolves.toBe(false);
    expect(manager.getSession()).not.toBeNull();
  });

  it('restore usa el refresh guardado y el usuario almacenado', async () => {
    const { manager, store } = setup(() => json(200, tokens(5)));
    store.setRefreshToken('r-guardado');
    store.setUser(user);
    const session = await manager.restore();
    expect(session?.claims.sub).toBe('usr-1');
    expect(session?.user?.name).toBe('Admin');
  });

  it('restore sin refresh guardado no llama al backend; después funciona con token', async () => {
    const { manager, store, fetchMock } = setup(() => json(200, tokens(7)));
    await expect(manager.restore()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    store.setRefreshToken('r-nuevo');
    await expect(manager.restore()).resolves.not.toBeNull();
  });

  it('el timer programado dispara el refresh', async () => {
    let n = 1;
    const { manager, scheduler, store } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : json(200, tokens(++n)),
    );
    await manager.login('admin@demo.co', 'x');
    scheduler.runAll();
    await vi.waitFor(() => expect(store.getRefreshToken()).toBe('r-2'));
  });

  it('logout limpia todo, avisa "logout" y tolera fallos del backend', async () => {
    const { manager, store, fetchMock } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      throw new TypeError('Failed to fetch');
    });
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    await manager.logout();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getUser()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null, 'logout');
    const logoutCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/logout'));
    expect(JSON.parse(String(logoutCall?.[1]?.body))).toEqual({ refresh_token: 'r-1' });
  });

  describe('waitForReauth', () => {
    /** Inicia sesión como usr-1, hace expirar la sesión y deja preparado el próximo login como `nextLoginSub`. */
    async function expiredManager(nextLoginSub: string) {
      let loginSub = 'usr-1';
      let n = 0;
      const { manager } = setup((url) => {
        if (url.endsWith('/auth/refresh')) return json(401, { error: { code: 'X', message: 'x' } });
        return json(200, { ...tokens(++n, loginSub), user });
      });
      await manager.login('admin@demo.co', 'x');
      await manager.refresh();
      loginSub = nextLoginSub;
      return manager;
    }

    it('resuelve true cuando el mismo usuario vuelve a entrar', async () => {
      const manager = await expiredManager('usr-1');
      const waiting = manager.waitForReauth();
      await manager.login('admin@demo.co', 'x');
      await expect(waiting).resolves.toBe(true);
    });

    it('resuelve false si entra otro usuario', async () => {
      const manager = await expiredManager('usr-2');
      const waiting = manager.waitForReauth();
      await manager.login('otro@demo.co', 'x');
      await expect(waiting).resolves.toBe(false);
    });

    it('resuelve false de inmediato si no hay una sesión expirada', async () => {
      const { manager } = setup(() => json(500, {}));
      await expect(manager.waitForReauth()).resolves.toBe(false);
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/api test`
Expected: FAIL — no se resuelven `./session` ni `./testing`.

- [ ] **Step 3: Implementar el JWT y las utilidades de prueba**

`packages/api/src/jwt.ts`:
```ts
/** Decodifica el payload de un JWT sin verificar la firma (la verificación es del backend). */
export function decodeJwtPayload(token: string): unknown {
  const part = token.split('.')[1];
  if (!part) throw new Error('JWT inválido');
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
```

`packages/api/src/testing/index.ts`:
```ts
import { decodeJwtPayload } from '../jwt';

function base64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** JWT sin firma válida, solo para mocks y tests. */
export function makeFakeJwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.firma-de-prueba`;
}

export function readFakeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = decodeJwtPayload(token);
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implementar el gestor de sesión**

`packages/api/src/session.ts`:
```ts
import { z } from 'zod';
import { apiErrorFromResponse, networkError } from './errors';
import { API_PREFIX } from './http';
import { decodeJwtPayload } from './jwt';
import { loginResponseSchema, refreshResponseSchema, type SessionUser } from './schemas/auth';
import { idSchema, roleSchema, type Role } from './schemas/common';

export interface TokenStore {
  getRefreshToken(): string | null;
  setRefreshToken(token: string | null): void;
  getUser(): SessionUser | null;
  setUser(user: SessionUser | null): void;
}

export class MemoryTokenStore implements TokenStore {
  private refreshToken: string | null = null;
  private user: SessionUser | null = null;
  getRefreshToken() {
    return this.refreshToken;
  }
  setRefreshToken(token: string | null) {
    this.refreshToken = token;
  }
  getUser() {
    return this.user;
  }
  setUser(user: SessionUser | null) {
    this.user = user;
  }
}

export interface SessionClaims {
  sub: string;
  role: Role;
  buildingId: string;
}

export interface Session {
  accessToken: string;
  claims: SessionClaims;
  user: SessionUser | null;
}

export type SessionEndReason = 'logout' | 'expired';
export type SessionListener = (session: Session | null, reason?: SessionEndReason) => void;

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const REFRESH_MARGIN_SECONDS = 120;

/** Cuándo renovar: 120 s antes de expirar, o a la mitad de la vida si el token es más corto que 2× el margen. */
export function refreshDelayMs(expiresInSeconds: number): number {
  return expiresInSeconds > REFRESH_MARGIN_SECONDS * 2
    ? (expiresInSeconds - REFRESH_MARGIN_SECONDS) * 1000
    : (expiresInSeconds * 1000) / 2;
}

const claimsSchema = z.object({ sub: idSchema, role: roleSchema, buildingId: idSchema });

export function decodeClaims(accessToken: string): SessionClaims {
  return claimsSchema.parse(decodeJwtPayload(accessToken));
}

export interface SessionManagerOptions {
  baseUrl: string;
  store: TokenStore;
  fetch?: typeof fetch;
  scheduler?: Scheduler;
}

export interface SessionManager {
  getAccessToken(): string | null;
  getSession(): Session | null;
  login(email: string, password: string): Promise<Session>;
  restore(): Promise<Session | null>;
  refresh(): Promise<boolean>;
  waitForReauth(): Promise<boolean>;
  logout(): Promise<void>;
  subscribe(listener: SessionListener): () => void;
}

interface TokenPayload {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createSessionManager(options: SessionManagerOptions): SessionManager {
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const scheduler = options.scheduler ?? defaultScheduler;
  const { store } = options;
  const listeners = new Set<SessionListener>();

  let session: Session | null = null;
  let lastSub: string | null = null;
  let expired = false;
  let timer: unknown = null;
  let inflight: Promise<boolean> | null = null;

  async function postJson(path: string, body: unknown, accessToken?: string): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await doFetch(`${options.baseUrl}${API_PREFIX}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw networkError(error);
    }
  }

  function emit(reason?: SessionEndReason) {
    for (const listener of [...listeners]) listener(session, reason);
  }

  function cancelTimer() {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  }

  function apply(tokens: TokenPayload, user: SessionUser | null): Session {
    const claims = decodeClaims(tokens.access_token);
    store.setRefreshToken(tokens.refresh_token);
    if (user) store.setUser(user);
    session = { accessToken: tokens.access_token, claims, user: user ?? store.getUser() };
    lastSub = claims.sub;
    expired = false;
    cancelTimer();
    timer = scheduler.setTimeout(() => {
      void refresh();
    }, refreshDelayMs(tokens.expires_in));
    emit();
    return session;
  }

  function clear(reason: SessionEndReason) {
    cancelTimer();
    expired = reason === 'expired' && session !== null;
    session = null;
    store.setRefreshToken(null);
    store.setUser(null);
    emit(reason);
  }

  async function doRefresh(): Promise<boolean> {
    const refreshToken = store.getRefreshToken();
    if (!refreshToken) {
      if (session) clear('expired');
      return false;
    }
    let response: Response;
    try {
      response = await postJson('/auth/refresh', { refresh_token: refreshToken });
    } catch {
      return false; // red caída: se conserva la sesión y se reintenta en la próxima petición
    }
    if (response.status === 401 || response.status === 403) {
      clear('expired');
      return false;
    }
    if (!response.ok) return false;
    const data = refreshResponseSchema.parse(await response.json());
    apply(data, data.user ?? null);
    return true;
  }

  function refresh(): Promise<boolean> {
    if (inflight) return inflight;
    const current = doRefresh().finally(() => {
      if (inflight === current) inflight = null;
    });
    inflight = current;
    return current;
  }

  function subscribe(listener: SessionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getAccessToken: () => session?.accessToken ?? null,
    getSession: () => session,

    async login(email, password) {
      const response = await postJson('/auth/login', { email, password });
      if (!response.ok) throw await apiErrorFromResponse(response);
      const data = loginResponseSchema.parse(await response.json());
      return apply(data, data.user);
    },

    async restore() {
      if (session) return session;
      const ok = await refresh();
      return ok ? session : null;
    },

    refresh,

    waitForReauth() {
      if (session) return Promise.resolve(true);
      if (!expired) return Promise.resolve(false);
      const expectedSub = lastSub;
      return new Promise<boolean>((resolve) => {
        const unsubscribe = subscribe((next, reason) => {
          if (next) {
            unsubscribe();
            resolve(next.claims.sub === expectedSub);
          } else if (reason === 'logout') {
            unsubscribe();
            resolve(false);
          }
        });
      });
    },

    async logout() {
      const refreshToken = store.getRefreshToken();
      const accessToken = session?.accessToken;
      clear('logout');
      if (!refreshToken) return;
      try {
        await postJson('/auth/logout', { refresh_token: refreshToken }, accessToken);
      } catch {
        // best-effort: la sesión local ya se cerró
      }
    },

    subscribe,
  };
}
```

Añadir a `packages/api/src/index.ts`:
```ts
export * from './jwt';
export * from './session';
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/api test; pnpm --filter @gd/api typecheck; pnpm lint`
Expected: PASS; sin errores.

- [ ] **Step 6: Commit**

```
git add packages/api
git commit -m "feat(api): gestor de sesión con refresh de vuelo único y re-autenticación"
```

---

### Task 7: Endpoints tipados por rol (`createApi`)

**Files:**
- Create: `packages/api/src/endpoints.ts`
- Modify: `packages/api/src/index.ts`
- Test: `packages/api/src/endpoints.test.ts`

**Interfaces:**
- Consumes: `HttpClient` (Task 5); schemas y tipos (Task 4).
- Produces:
  - `interface AlertFilters { level?: 'CRITICAL' | 'WARNING' | 'INFO'; acknowledged?: boolean }`; `interface DateRange { desde?: string; hasta?: string }`
  - `createApi(http: HttpClient)` con:
    - `dashboard.general(signal?)`, `dashboard.structural(signal?)`, `dashboard.consumption(signal?)`, `dashboard.comfortAdmin(signal?)`, `dashboard.comfortResidente(signal?)`
    - `sensors.list(signal?)`, `sensors.readings(sensorId: string, range: DateRange, signal?)`
    - `alerts.listAdmin(filters?: AlertFilters, signal?)`, `alerts.listResidente(filters?: AlertFilters, signal?)`, `alerts.ack(alertId: string)`
    - `maintenance.list(status?: MaintenanceStatus, signal?)`, `maintenance.create(input: { description: string; due_date?: string | null })`
    - `reports.structuralHealth(range?: DateRange, signal?): Promise<Blob>`
  - `type Api = ReturnType<typeof createApi>`

- [ ] **Step 1: Escribir el test que falla**

`packages/api/src/endpoints.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createApi } from './endpoints';
import { createHttpClient } from './http';

const alert = {
  alert_id: 'alrt-20261002-00001',
  building_id: 'bld-1',
  sensor_id: 's1',
  level: 'CRITICAL',
  category: 'structural',
  message: 'm',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 1,
  threshold_configured: 0.5,
  occurrence_count: 3,
  acknowledged_by: null,
  acknowledged_at: null,
};

function apiReturning(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  const api = createApi(
    createHttpClient({
      baseUrl: 'http://api.test',
      getAccessToken: () => 't',
      refreshAccessToken: async () => false,
      validation: 'strict',
      fetch: fetchMock as unknown as typeof fetch,
    }),
  );
  const call = (i = 0) => fetchMock.mock.calls[i] as unknown as [string, RequestInit];
  return { api, call };
}

describe('createApi', () => {
  it('alerts.listResidente filtra por query y nunca expone valores numéricos', async () => {
    const { api, call } = apiReturning({ count: 1, data: [alert] });
    const result = await api.alerts.listResidente({ level: 'CRITICAL', acknowledged: false });
    expect(call()[0]).toBe('http://api.test/api/v1/alerts?level=CRITICAL&acknowledged=false');
    expect(result.data[0]).not.toHaveProperty('value_triggered');
  });

  it('alerts.listAdmin conserva los campos de administrador', async () => {
    const { api } = apiReturning({ count: 1, data: [alert] });
    const result = await api.alerts.listAdmin();
    expect(result.data[0]?.occurrence_count).toBe(3);
  });

  it('alerts.ack hace POST con el id codificado', async () => {
    const { api, call } = apiReturning({ ...alert, acknowledged: true });
    await api.alerts.ack('alrt-20261002-00001');
    expect(call()[0]).toBe('http://api.test/api/v1/alerts/alrt-20261002-00001/ack');
    expect(call()[1].method).toBe('POST');
  });

  it('sensors.readings envía desde/hasta', async () => {
    const { api, call } = apiReturning([]);
    await api.sensors.readings('acc 1', { desde: '2026-10-01T00:00:00Z', hasta: '2026-10-02T00:00:00Z' });
    expect(call()[0]).toBe(
      'http://api.test/api/v1/sensors/acc%201/data?desde=2026-10-01T00%3A00%3A00Z&hasta=2026-10-02T00%3A00%3A00Z',
    );
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @gd/api test`
Expected: FAIL — no se resuelve `./endpoints`.

- [ ] **Step 3: Implementar**

`packages/api/src/endpoints.ts`:
```ts
import type { HttpClient } from './http';
import { alertAdminSchema, alertListAdminSchema, alertListResidenteSchema } from './schemas/alerts';
import {
  comfortAdminSchema,
  comfortResidenteSchema,
  dashboardConsumptionSchema,
  dashboardGeneralSchema,
  dashboardStructuralSchema,
} from './schemas/dashboard';
import { maintenanceListSchema, maintenanceTaskSchema, type MaintenanceStatus } from './schemas/maintenance';
import { readingListSchema, sensorListSchema } from './schemas/sensors';

export interface AlertFilters {
  level?: 'CRITICAL' | 'WARNING' | 'INFO';
  acknowledged?: boolean;
}

export interface DateRange {
  desde?: string;
  hasta?: string;
}

const alertQuery = (filters: AlertFilters) => ({ level: filters.level, acknowledged: filters.acknowledged });
const enc = encodeURIComponent;

export function createApi(http: HttpClient) {
  return {
    dashboard: {
      general: (signal?: AbortSignal) => http.get('/dashboard/general', { schema: dashboardGeneralSchema, signal }),
      structural: (signal?: AbortSignal) =>
        http.get('/dashboard/structural', { schema: dashboardStructuralSchema, signal }),
      consumption: (signal?: AbortSignal) =>
        http.get('/dashboard/consumption', { schema: dashboardConsumptionSchema, signal }),
      comfortAdmin: (signal?: AbortSignal) => http.get('/dashboard/comfort', { schema: comfortAdminSchema, signal }),
      comfortResidente: (signal?: AbortSignal) =>
        http.get('/dashboard/comfort', { schema: comfortResidenteSchema, signal }),
    },
    sensors: {
      list: (signal?: AbortSignal) => http.get('/sensors', { schema: sensorListSchema, signal }),
      readings: (sensorId: string, range: DateRange, signal?: AbortSignal) =>
        http.get(`/sensors/${enc(sensorId)}/data`, {
          schema: readingListSchema,
          query: { desde: range.desde, hasta: range.hasta },
          signal,
        }),
    },
    alerts: {
      listAdmin: (filters: AlertFilters = {}, signal?: AbortSignal) =>
        http.get('/alerts', { schema: alertListAdminSchema, query: alertQuery(filters), signal }),
      listResidente: (filters: AlertFilters = {}, signal?: AbortSignal) =>
        http.get('/alerts', { schema: alertListResidenteSchema, query: alertQuery(filters), signal }),
      ack: (alertId: string) => http.post(`/alerts/${enc(alertId)}/ack`, { schema: alertAdminSchema }),
    },
    maintenance: {
      list: (status?: MaintenanceStatus, signal?: AbortSignal) =>
        http.get('/maintenance', { schema: maintenanceListSchema, query: { status }, signal }),
      create: (input: { description: string; due_date?: string | null }) =>
        http.post('/maintenance', { schema: maintenanceTaskSchema, body: input }),
    },
    reports: {
      structuralHealth: (range: DateRange = {}, signal?: AbortSignal) =>
        http.getBlob('/reports/structural_health', { query: { desde: range.desde, hasta: range.hasta }, signal }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
```

Añadir a `packages/api/src/index.ts`:
```ts
export * from './endpoints';
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/api test; pnpm --filter @gd/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add packages/api
git commit -m "feat(api): endpoints tipados por rol"
```

---

### Task 8: Hooks de datos compartidos (`@gd/query`)

**Files:**
- Create: `packages/query/package.json`, `packages/query/tsconfig.json`, `packages/query/vitest.config.ts`
- Create: `packages/query/src/ApiContext.tsx`, `keys.ts`, `intervals.ts`, `hooks.ts`, `index.ts`
- Test: `packages/query/src/hooks.test.tsx`

**Interfaces:**
- Consumes: `Api`, `AlertFilters`, `Role`, `DashboardGeneral`, `AlertListResidente` (Tasks 4 y 7).
- Produces:
  - `ApiProvider({ api, children })`; `useApi(): Api`
  - `queryKeys.dashboard.general()`, `queryKeys.alerts.all()`, `queryKeys.alerts.list(role: Role, filters: AlertFilters)`, `queryKeys.sensors.list()`
  - `POLL_INTERVALS_MS = { dashboardGeneral: 30_000, dashboardComfort: 30_000, dashboardStructural: 60_000, sensors: 60_000, alerts: 60_000, dashboardConsumption: 300_000 }`
  - `useDashboardGeneral(): UseQueryResult<DashboardGeneral>`
  - `useAlerts(role: Role, filters?: AlertFilters): UseQueryResult<AlertListResidente>` (ADMIN usa `listAdmin`; el resultado se tipa con la forma común)

- [ ] **Step 1: Crear el paquete**

`packages/query/package.json`:
```json
{
  "name": "@gd/query",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" }
}
```

`packages/query/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023", "DOM"], "jsx": "react-jsx" },
  "include": ["src", "vitest.config.ts"]
}
```

`packages/query/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'jsdom' } });
```

Run:
```
pnpm --filter @gd/query add @gd/api@workspace:* @tanstack/react-query@^5
pnpm --filter @gd/query add -D react@^19 react-dom@^19 @types/react@^19 @types/react-dom@^19 @testing-library/react@^16 jsdom vitest@^4 typescript@~5.9.3
pnpm --filter @gd/query pkg set peerDependencies.react="^19"
```

- [ ] **Step 2: Escribir el test que falla**

`packages/query/src/hooks.test.tsx`:
```tsx
import type { Api } from '@gd/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiContext';
import { useAlerts, useDashboardGeneral } from './hooks';

const general = {
  health_score: 96,
  alerts_summary: { CRITICAL: 0, WARNING: 0, INFO: 2, total: 2 },
  sensors: { total: 22, online: 22, offline: 0 },
  generated_at: '2026-10-02T15:00:00Z',
};

function wrapper(api: Api) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('hooks de @gd/query', () => {
  it('useDashboardGeneral obtiene el estado general', async () => {
    const api = { dashboard: { general: vi.fn().mockResolvedValue(general) } } as unknown as Api;
    const { result } = renderHook(() => useDashboardGeneral(), { wrapper: wrapper(api) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.health_score).toBe(96);
  });

  it('useAlerts usa el endpoint del rol con los filtros', async () => {
    const listResidente = vi.fn().mockResolvedValue({ count: 0, data: [] });
    const listAdmin = vi.fn();
    const api = { alerts: { listResidente, listAdmin } } as unknown as Api;
    const { result } = renderHook(() => useAlerts('RESIDENTE', { level: 'CRITICAL', acknowledged: false }), {
      wrapper: wrapper(api),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listResidente).toHaveBeenCalledWith({ level: 'CRITICAL', acknowledged: false }, expect.anything());
    expect(listAdmin).not.toHaveBeenCalled();
  });

  it('useApi fuera del provider lanza un error claro', () => {
    const client = new QueryClient();
    expect(() =>
      renderHook(() => useDashboardGeneral(), {
        wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
      }),
    ).toThrow(/ApiProvider/);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm --filter @gd/query test`
Expected: FAIL — no se resuelven `./ApiContext` ni `./hooks`.

- [ ] **Step 4: Implementar**

`packages/query/src/ApiContext.tsx`:
```tsx
import type { Api } from '@gd/api';
import { createContext, useContext, type ReactNode } from 'react';

const ApiContext = createContext<Api | null>(null);

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi debe usarse dentro de <ApiProvider>');
  return api;
}
```

`packages/query/src/keys.ts`:
```ts
import type { AlertFilters, Role } from '@gd/api';

export const queryKeys = {
  all: ['gd'] as const,
  dashboard: {
    general: () => ['gd', 'dashboard', 'general'] as const,
  },
  alerts: {
    all: () => ['gd', 'alerts'] as const,
    list: (role: Role, filters: AlertFilters) => ['gd', 'alerts', role, filters] as const,
  },
  sensors: {
    list: () => ['gd', 'sensors'] as const,
  },
};
```

`packages/query/src/intervals.ts`:
```ts
/** Intervalos de polling (spec §8.1). TanStack Query los pausa con la pestaña oculta. */
export const POLL_INTERVALS_MS = {
  dashboardGeneral: 30_000,
  dashboardComfort: 30_000,
  dashboardStructural: 60_000,
  sensors: 60_000,
  alerts: 60_000,
  dashboardConsumption: 300_000,
} as const;
```

`packages/query/src/hooks.ts`:
```ts
import type { AlertFilters, AlertListResidente, DashboardGeneral, Role } from '@gd/api';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApi } from './ApiContext';
import { POLL_INTERVALS_MS } from './intervals';
import { queryKeys } from './keys';

export function useDashboardGeneral(): UseQueryResult<DashboardGeneral> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.general(),
    queryFn: ({ signal }) => api.dashboard.general(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardGeneral,
  });
}

/** Lista de alertas con la forma común a ambos roles (sin campos numéricos). */
export function useAlerts(role: Role, filters: AlertFilters = {}): UseQueryResult<AlertListResidente> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.alerts.list(role, filters),
    queryFn: ({ signal }): Promise<AlertListResidente> =>
      role === 'ADMIN' ? api.alerts.listAdmin(filters, signal) : api.alerts.listResidente(filters, signal),
    refetchInterval: POLL_INTERVALS_MS.alerts,
  });
}
```

`packages/query/src/index.ts`:
```ts
export * from './ApiContext';
export * from './keys';
export * from './intervals';
export * from './hooks';
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/query test; pnpm --filter @gd/query typecheck; pnpm lint`
Expected: PASS. (El error esperado del tercer test puede imprimirse en consola; es normal.)

- [ ] **Step 6: Commit**

```
git add packages/query pnpm-lock.yaml
git commit -m "feat(query): ApiProvider, query keys, intervalos y hooks base"
```

---

### Task 9: App web, tokens de diseño y componentes base de estado

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`
- Create: `apps/web/.env.development`, `apps/web/.env.api`, `apps/web/.env.production`, `apps/web/src/vite-env.d.ts`, `apps/web/src/main.tsx`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/ui/tokens.css`, `statusMeta.ts`, `StatusBadge.tsx`, `StatusBadge.module.css`, `KpiCard.tsx`, `KpiCard.module.css`, `DataState.tsx`, `DataState.module.css`, `Button.tsx`, `Button.module.css`, `useNow.ts`
- Create: `apps/web/src/app/errorMessage.ts`
- Test: `apps/web/src/ui/StatusBadge.test.tsx`, `apps/web/src/ui/DataState.test.tsx`, `apps/web/src/app/errorMessage.test.ts`

**Interfaces:**
- Consumes: `StatusLevel`, `ageMs`, `formatTime`, `formatDateTime`, `formatRelative` (`@gd/domain`); `ApiError`, `ContractDriftError` (`@gd/api`).
- Produces:
  - `STATUS_META: Record<StatusLevel, { label: string; Icon: LucideIcon }>`
  - `statusLabel(level: StatusLevel, lastSeenAt: string | null, now: Date): string`
  - `StatusBadge({ level, lastSeenAt?, now? })`
  - `KpiCard({ label, value, hint?, tone? })` con `tone?: StatusLevel`
  - `DataState<T>({ query, label, children: (data: T) => ReactNode, isEmpty?, emptyMessage?, staleAfterMs? })`
  - `Button({ variant?: 'primary' | 'secondary', ...buttonProps })`
  - `useNow(intervalMs?: number): Date`
  - `errorMessage(error: unknown): string`

- [ ] **Step 1: Crear la app**

`apps/web/package.json`:
```json
{
  "name": "@gd/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:api": "vite --mode api",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  }
}
```

Run:
```
pnpm --filter @gd/web add @gd/api@workspace:* @gd/domain@workspace:* @gd/query@workspace:* @tanstack/react-query@^5 react@^19 react-dom@^19 react-router@^7 lucide-react
pnpm --filter @gd/web add -D vite@^7 @vitejs/plugin-react@^5 vitest@^4 jsdom @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 msw@^2 @playwright/test @axe-core/playwright typescript@~5.9.3 @types/react@^19 @types/react-dom@^19 @types/node@^24
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client", "node"]
  },
  "include": ["src", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="es-CO">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gemelo Digital</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
```

`apps/web/vitest.config.ts`:
```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
```

`apps/web/.env.development`:
```
VITE_USE_MOCKS=true
VITE_API_BASE_URL=
```

`apps/web/.env.api` (backend real local; ajustar el puerto si el backend usa otro):
```
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:3000
```

`apps/web/.env.production`:
```
VITE_USE_MOCKS=false
VITE_API_BASE_URL=
```

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`apps/web/src/test/setup.ts` (se amplía en Task 10):
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

`apps/web/src/main.tsx` (provisional; se reemplaza en Task 11):
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');
createRoot(root).render(
  <StrictMode>
    <p>Gemelo Digital</p>
  </StrictMode>,
);
```

- [ ] **Step 2: Escribir los tests que fallan**

`apps/web/src/ui/StatusBadge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, statusLabel } from './StatusBadge';

const NOW = new Date('2026-10-02T21:45:00Z');
const n = (s: string) => s.replace(/\s/g, ' ');

describe('statusLabel', () => {
  it('tiene texto para cada estado', () => {
    expect(statusLabel('CRITICAL', null, NOW)).toBe('Crítico');
    expect(statusLabel('WARNING', null, NOW)).toBe('Advertencia');
    expect(statusLabel('INFO', null, NOW)).toBe('Informativo');
    expect(statusLabel('OK', null, NOW)).toBe('Normal');
  });
  it('OFFLINE dice desde cuándo no hay datos', () => {
    expect(n(statusLabel('OFFLINE', '2026-10-02T20:45:00Z', NOW))).toMatch(/^Sin datos desde 3:45 p\. ?m\.$/);
    expect(statusLabel('OFFLINE', null, NOW)).toBe('Sin datos');
  });
  it('OFFLINE de hace más de un día incluye la fecha', () => {
    expect(n(statusLabel('OFFLINE', '2026-09-28T20:45:00Z', NOW))).toMatch(/^Sin datos desde 28 (de )?sept?\.?/);
  });
});

describe('StatusBadge', () => {
  it('muestra icono decorativo + texto y expone el nivel', () => {
    const { container } = render(<StatusBadge level="CRITICAL" />);
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(container.querySelector('[data-level="CRITICAL"] svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

`apps/web/src/ui/DataState.test.tsx`:
```tsx
import type { UseQueryResult } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@gd/api';
import { DataState } from './DataState';

function fakeQuery<T>(partial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
    ...partial,
  } as unknown as UseQueryResult<T>;
}

describe('DataState', () => {
  it('cargando: muestra un estado ocupado accesible', () => {
    render(<DataState label="sensores" query={fakeQuery<number[]>({ isPending: true })}>{() => null}</DataState>);
    expect(screen.getByRole('status', { name: 'Cargando sensores' })).toHaveAttribute('aria-busy', 'true');
  });

  it('error sin datos: mensaje y botón Reintentar', async () => {
    const refetch = vi.fn();
    const error = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' });
    render(
      <DataState label="sensores" query={fakeQuery<number[]>({ isError: true, error, refetch })}>
        {() => null}
      </DataState>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('con datos: renderiza el contenido y la antigüedad', () => {
    render(
      <DataState label="sensores" query={fakeQuery({ data: [1, 2] })}>
        {(data) => <p>{data.length} sensores</p>}
      </DataState>,
    );
    expect(screen.getByText('2 sensores')).toBeInTheDocument();
    expect(screen.getByText(/Actualizado justo ahora/)).toBeInTheDocument();
  });

  it('vacío: muestra el mensaje propio', () => {
    render(
      <DataState
        label="sensores"
        query={fakeQuery({ data: [] as number[] })}
        isEmpty={(d) => d.length === 0}
        emptyMessage="Aún no hay sensores."
      >
        {() => <p>contenido</p>}
      </DataState>,
    );
    expect(screen.getByText('Aún no hay sensores.')).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('marca el dato como desactualizado si supera el límite o si falló el refresco', () => {
    const { rerender } = render(
      <DataState label="x" staleAfterMs={60_000} query={fakeQuery({ data: 1, dataUpdatedAt: Date.now() - 120_000 })}>
        {() => <p>dato</p>}
      </DataState>,
    );
    expect(screen.getByText('Dato desactualizado')).toBeInTheDocument();
    rerender(
      <DataState label="x" query={fakeQuery({ data: 1, isError: true, error: new Error('x') })}>
        {() => <p>dato</p>}
      </DataState>,
    );
    expect(screen.getByText('Dato desactualizado')).toBeInTheDocument();
  });
});
```

`apps/web/src/app/errorMessage.test.ts`:
```ts
import { ApiError, ContractDriftError } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';

const apiError = (status: number) => new ApiError({ status, code: `HTTP_${status}`, message: 'del servidor' });

describe('errorMessage', () => {
  it('traduce los casos conocidos', () => {
    expect(errorMessage(apiError(0))).toMatch(/No se pudo conectar/);
    expect(errorMessage(apiError(403))).toMatch(/No tienes permiso/);
    expect(errorMessage(apiError(404))).toMatch(/No encontramos/);
    expect(errorMessage(apiError(429))).toMatch(/Demasiadas solicitudes/);
    expect(errorMessage(apiError(503))).toMatch(/El servidor tuvo un problema/);
    expect(errorMessage(new ContractDriftError({ method: 'GET', path: '/x', issues: [] }))).toMatch(/formato inesperado/);
  });
  it('usa el mensaje del backend para otros códigos y uno genérico para lo desconocido', () => {
    expect(errorMessage(apiError(409))).toBe('del servidor');
    expect(errorMessage('???')).toMatch(/Ocurrió un error inesperado/);
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelven los módulos de `ui/` ni `app/errorMessage`.

- [ ] **Step 4: Implementar estilos y componentes**

`apps/web/src/ui/tokens.css`:
```css
:root {
  color-scheme: light dark;
  --font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --text: #101828;
  --text-muted: #475467;
  --border: #d0d5dd;
  --accent: #175cd3;
  --accent-text: #ffffff;
  --focus: #175cd3;
  --status-critical-fg: #b42318;
  --status-critical-bg: #fee4e2;
  --status-warning-fg: #93370d;
  --status-warning-bg: #fef0c7;
  --status-info-fg: #175cd3;
  --status-info-bg: #d1e9ff;
  --status-ok-fg: #067647;
  --status-ok-bg: #dcfae6;
  --status-offline-fg: #344054;
  --status-offline-bg: #eaecf0;
  --radius: 8px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0c111d;
    --surface: #161b26;
    --text: #f5f5f6;
    --text-muted: #cecfd2;
    --border: #333741;
    --accent: #84caff;
    --accent-text: #0c111d;
    --focus: #84caff;
    --status-critical-fg: #fda29b;
    --status-critical-bg: #55160c;
    --status-warning-fg: #fec84b;
    --status-warning-bg: #4e1d09;
    --status-info-fg: #84caff;
    --status-info-bg: #102a56;
    --status-ok-fg: #75e0a7;
    --status-ok-bg: #053321;
    --status-offline-fg: #cecfd2;
    --status-offline-bg: #333741;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}

button,
input {
  font: inherit;
}

:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

`apps/web/src/ui/statusMeta.ts`:
```ts
import type { StatusLevel } from '@gd/domain';
import { Ban, CircleCheck, Info, OctagonX, TriangleAlert, type LucideIcon } from 'lucide-react';

export const STATUS_META: Record<StatusLevel, { label: string; Icon: LucideIcon }> = {
  CRITICAL: { label: 'Crítico', Icon: OctagonX },
  WARNING: { label: 'Advertencia', Icon: TriangleAlert },
  INFO: { label: 'Informativo', Icon: Info },
  OK: { label: 'Normal', Icon: CircleCheck },
  OFFLINE: { label: 'Sin datos', Icon: Ban },
};
```

`apps/web/src/ui/StatusBadge.module.css`:
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}
.badge[data-level='CRITICAL'] { color: var(--status-critical-fg); background: var(--status-critical-bg); }
.badge[data-level='WARNING'] { color: var(--status-warning-fg); background: var(--status-warning-bg); }
.badge[data-level='INFO'] { color: var(--status-info-fg); background: var(--status-info-bg); }
.badge[data-level='OK'] { color: var(--status-ok-fg); background: var(--status-ok-bg); }
.badge[data-level='OFFLINE'] {
  color: var(--status-offline-fg);
  background: repeating-linear-gradient(
    135deg,
    var(--status-offline-bg),
    var(--status-offline-bg) 6px,
    transparent 6px,
    transparent 9px
  ),
  var(--status-offline-bg);
}
```

`apps/web/src/ui/StatusBadge.tsx`:
```tsx
import { ageMs, formatDateTime, formatTime, type StatusLevel } from '@gd/domain';
import styles from './StatusBadge.module.css';
import { STATUS_META } from './statusMeta';

const DAY_MS = 24 * 60 * 60 * 1000;

export function statusLabel(level: StatusLevel, lastSeenAt: string | null, now: Date): string {
  if (level !== 'OFFLINE') return STATUS_META[level].label;
  const age = ageMs(lastSeenAt, now);
  if (age === null) return 'Sin datos';
  return `Sin datos desde ${age < DAY_MS ? formatTime(lastSeenAt) : formatDateTime(lastSeenAt)}`;
}

interface StatusBadgeProps {
  level: StatusLevel;
  lastSeenAt?: string | null;
  now?: Date;
}

export function StatusBadge({ level, lastSeenAt = null, now = new Date() }: StatusBadgeProps) {
  const { Icon } = STATUS_META[level];
  return (
    <span className={styles.badge} data-level={level}>
      <Icon aria-hidden="true" size={16} />
      {statusLabel(level, lastSeenAt, now)}
    </span>
  );
}
```

`apps/web/src/ui/KpiCard.module.css`:
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: var(--radius);
  padding: var(--space-4);
}
.card[data-tone='CRITICAL'] { border-left-color: var(--status-critical-fg); }
.card[data-tone='WARNING'] { border-left-color: var(--status-warning-fg); }
.card[data-tone='INFO'] { border-left-color: var(--status-info-fg); }
.card[data-tone='OK'] { border-left-color: var(--status-ok-fg); }
.card[data-tone='OFFLINE'] { border-left-color: var(--status-offline-fg); }
.label { margin: 0; color: var(--text-muted); font-size: 0.875rem; }
.value { margin: var(--space-1) 0 0; font-size: 1.75rem; font-weight: 700; }
.hint { margin: var(--space-1) 0 0; color: var(--text-muted); font-size: 0.875rem; }
```

`apps/web/src/ui/KpiCard.tsx`:
```tsx
import type { StatusLevel } from '@gd/domain';
import type { ReactNode } from 'react';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatusLevel;
}

export function KpiCard({ label, value, hint, tone }: KpiCardProps) {
  return (
    <div className={styles.card} data-tone={tone}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
```

`apps/web/src/ui/useNow.ts`:
```ts
import { useEffect, useState } from 'react';

/** Fecha actual que se refresca cada `intervalMs` para textos como "hace 5 min". */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

`apps/web/src/app/errorMessage.ts`:
```ts
import { ApiError, ContractDriftError } from '@gd/api';

const GENERIC = 'Ocurrió un error inesperado. Intenta de nuevo.';

export function errorMessage(error: unknown): string {
  if (error instanceof ContractDriftError) {
    return 'Recibimos datos con un formato inesperado. Intenta de nuevo más tarde.';
  }
  if (error instanceof ApiError) {
    if (error.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    if (error.status === 403) return 'No tienes permiso para ver esta información.';
    if (error.status === 404) return 'No encontramos esta información.';
    if (error.status === 429) return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
    if (error.status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.';
    return error.message || GENERIC;
  }
  return GENERIC;
}
```

`apps/web/src/ui/Button.module.css`:
```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-weight: 600;
  cursor: pointer;
}
.button:disabled { opacity: 0.6; cursor: not-allowed; }
.primary { background: var(--accent); color: var(--accent-text); }
.secondary { background: var(--surface); color: var(--text); border-color: var(--border); }
```

`apps/web/src/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={[styles.button, styles[variant], className].filter(Boolean).join(' ')} {...props} />;
}
```

`apps/web/src/ui/DataState.module.css`:
```css
.skeleton {
  min-height: 96px;
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--border), var(--surface), var(--border));
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
.error {
  padding: var(--space-4);
  border-radius: var(--radius);
  background: var(--status-critical-bg);
  color: var(--status-critical-fg);
}
.empty { color: var(--text-muted); }
.meta {
  margin: var(--space-2) 0 0;
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
.staleTag {
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--status-warning-bg);
  color: var(--status-warning-fg);
  font-weight: 600;
}
```

`apps/web/src/ui/DataState.tsx`:
```tsx
import { formatRelative } from '@gd/domain';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { errorMessage } from '../app/errorMessage';
import { Button } from './Button';
import styles from './DataState.module.css';
import { useNow } from './useNow';

interface DataStateProps<T> {
  query: UseQueryResult<T>;
  /** Nombre en minúscula para lectores de pantalla: "Cargando {label}". */
  label: string;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  staleAfterMs?: number;
}

export function DataState<T>({
  query,
  label,
  children,
  isEmpty,
  emptyMessage = 'No hay datos para mostrar.',
  staleAfterMs,
}: DataStateProps<T>) {
  const now = useNow();

  if (query.isPending) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={`Cargando ${label}`} />;
  }

  if (query.data === undefined) {
    return (
      <div className={styles.error} role="alert">
        <p>{errorMessage(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const data = query.data;
  const stale = query.isError || (staleAfterMs !== undefined && now.getTime() - query.dataUpdatedAt > staleAfterMs);

  return (
    <div>
      {isEmpty?.(data) ? <p className={styles.empty}>{emptyMessage}</p> : children(data)}
      <p className={styles.meta}>
        {stale && <span className={styles.staleTag}>Dato desactualizado</span>}
        <span>Actualizado {formatRelative(new Date(query.dataUpdatedAt).toISOString(), now)}</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): app Vite, tokens de diseño y componentes de estado"
```

---

### Task 10: Backend simulado con MSW (seed determinista, auth, dashboards, alertas, sensores)

**Files:**
- Create: `apps/web/src/mocks/seed.ts`, `db.ts`, `auth.ts`, `handlers/auth.ts`, `handlers/dashboard.ts`, `handlers/alerts.ts`, `handlers/sensors.ts`, `handlers/index.ts`, `browser.ts`, `server.ts`
- Create: `apps/web/public/mockServiceWorker.js` (generado)
- Modify: `apps/web/src/test/setup.ts`
- Test: `apps/web/src/mocks/handlers.test.ts`

**Interfaces:**
- Consumes: `makeFakeJwt`, `readFakeJwt` (`@gd/api/testing`); tipos `Sensor`, `AlertAdmin`, `AlertResidente`, `Role`; `isOffline` (`@gd/domain`); `createHttpClient`, `createSessionManager`, `createApi`, `MemoryTokenStore`, `ApiError`.
- Produces:
  - `seed.ts`: `BUILDING_ID`, `DEMO_PASSWORD = 'Demo1234!'`, `ADMIN_EMAIL = 'admin@demo.co'`, `RESIDENTE_EMAIL = 'residente@demo.co'`, `RATE_LIMITED_EMAIL = 'limite@demo.co'`, `SCENARIOS`, `type Scenario = 'sano' | 'critico' | 'caido' | 'vacio'`, `isScenario(v: unknown): v is Scenario`, `interface MockUser`, `USERS`, `createSeed(scenario: Scenario, now: number): { sensors: Sensor[]; alerts: AlertAdmin[] }`
  - `db.ts`: `db: MockDb`, `resetDb(scenario?: Scenario, now?: number): void`
  - `browser.ts`: `startMockWorker(): Promise<void>`; `window.__gdMocks = { expireAccessTokens(), revokeRefreshTokens(), reset(scenario?) }`
  - `server.ts`: `server` (msw/node)
- Puntajes esperados por escenario (los usan los tests de Task 13 y Task 14): **sano 96** (2 INFO abiertas), **critico 56** (1 CRITICAL + 1 WARNING + 2 INFO abiertas + 1 sensor sin datos), **caido 66** (2 INFO + 6 sin datos), **vacio 100**.
- Supuestos del mock (a validar con el backend real): el 5.º intento fallido devuelve **423 `ACCOUNT_LOCKED`**; el rate limit devuelve **429 con `Retry-After`**.

- [ ] **Step 1: Generar el service worker de MSW**

Run: `pnpm --filter @gd/web exec msw init public --save`
Expected: se crea `apps/web/public/mockServiceWorker.js` y `package.json` obtiene `"msw": { "workerDirectory": ["public"] }`.

- [ ] **Step 2: Escribir el test que falla**

`apps/web/src/mocks/handlers.test.ts`:
```ts
import {
  ApiError,
  MemoryTokenStore,
  createApi,
  createHttpClient,
  createSessionManager,
} from '@gd/api';
import { describe, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { ADMIN_EMAIL, DEMO_PASSWORD, RATE_LIMITED_EMAIL, RESIDENTE_EMAIL } from './seed';

const BASE = 'http://localhost';

function client() {
  const session = createSessionManager({ baseUrl: BASE, store: new MemoryTokenStore() });
  const http = createHttpClient({
    baseUrl: BASE,
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refresh(),
    validation: 'strict',
  });
  return { session, api: createApi(http) };
}

async function rawGet(path: string, token: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json() as Promise<Record<string, unknown>>;
}

describe('backend simulado', () => {
  it.each([
    ['sano', 96],
    ['critico', 56],
    ['caido', 66],
    ['vacio', 100],
  ] as const)('escenario %s → health_score %i (respuesta válida según contrato)', async (scenario, score) => {
    resetDb(scenario);
    const { session, api } = client();
    await session.login(ADMIN_EMAIL, DEMO_PASSWORD);
    const general = await api.dashboard.general();
    expect(general.health_score).toBe(score);
  });

  it('el residente recibe 403 en /sensors', async () => {
    const { session, api } = client();
    await session.login(RESIDENTE_EMAIL, DEMO_PASSWORD);
    await expect(api.sensors.list()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('el residente no recibe valores numéricos en alertas ni ppm en confort', async () => {
    resetDb('critico');
    const { session } = client();
    const s = await session.login(RESIDENTE_EMAIL, DEMO_PASSWORD);
    const alerts = (await rawGet('/alerts', s.accessToken)) as { data: Record<string, unknown>[] };
    expect(alerts.data.length).toBeGreaterThan(0);
    for (const a of alerts.data) {
      expect(a).not.toHaveProperty('value_triggered');
      expect(a).not.toHaveProperty('threshold_configured');
    }
    const comfort = (await rawGet('/dashboard/comfort', s.accessToken)) as { zones: Record<string, unknown>[] };
    for (const z of comfort.zones) expect(z).not.toHaveProperty('ppm');
  });

  it('bloquea la cuenta en el 5.º intento fallido, incluso con la contraseña correcta después', async () => {
    const { session } = client();
    for (let i = 1; i <= 4; i++) {
      await expect(session.login(ADMIN_EMAIL, 'mala')).rejects.toMatchObject({ status: 401 });
    }
    await expect(session.login(ADMIN_EMAIL, 'mala')).rejects.toMatchObject({ status: 423, code: 'ACCOUNT_LOCKED' });
    await expect(session.login(ADMIN_EMAIL, DEMO_PASSWORD)).rejects.toMatchObject({ status: 423 });
  });

  it('simula rate limit con Retry-After', async () => {
    const { session } = client();
    const err = await session.login(RATE_LIMITED_EMAIL, DEMO_PASSWORD).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, retryAfterSeconds: 30 });
  });

  it('rota el refresh token: el anterior queda inválido', async () => {
    const store = new MemoryTokenStore();
    const session = createSessionManager({ baseUrl: BASE, store });
    await session.login(ADMIN_EMAIL, DEMO_PASSWORD);
    const first = store.getRefreshToken();
    await expect(session.refresh()).resolves.toBe(true);
    const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: first }),
    });
    expect(res.status).toBe(401);
  });

  it('un access token invalidado se renueva de forma transparente', async () => {
    const { session, api } = client();
    await session.login(ADMIN_EMAIL, DEMO_PASSWORD);
    db.settings.accessValidAfterMs = Date.now() + 1;
    await new Promise((r) => setTimeout(r, 5));
    await expect(api.dashboard.general()).resolves.toMatchObject({ health_score: 96 });
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — no se resuelven `./db` ni `./seed`.

- [ ] **Step 4: Implementar seed y db**

`apps/web/src/mocks/seed.ts`:
```ts
import type { AlertAdmin, Role, Sensor } from '@gd/api';

export const BUILDING_ID = 'bld-demo-01';
export const DEMO_PASSWORD = 'Demo1234!';
export const ADMIN_EMAIL = 'admin@demo.co';
export const RESIDENTE_EMAIL = 'residente@demo.co';
/** Cualquier login con este correo responde 429 (para probar el rate limit). */
export const RATE_LIMITED_EMAIL = 'limite@demo.co';

export const SCENARIOS = ['sano', 'critico', 'caido', 'vacio'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function isScenario(value: unknown): value is Scenario {
  return typeof value === 'string' && (SCENARIOS as readonly string[]).includes(value);
}

export interface MockUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  buildingId: string;
}

export const USERS: MockUser[] = [
  { id: 'usr-admin-01', email: ADMIN_EMAIL, password: DEMO_PASSWORD, name: 'Administración Demo', role: 'ADMIN', buildingId: BUILDING_ID },
  { id: 'usr-res-01', email: RESIDENTE_EMAIL, password: DEMO_PASSWORD, name: 'Residente Demo', role: 'RESIDENTE', buildingId: BUILDING_ID },
];

const MIN = 60_000;

function sensor(
  now: number,
  id: string,
  name: string,
  sensorType: string,
  category: Sensor['category'],
  zone: string,
  unit: string,
  lastValues: Record<string, number>,
): Sensor {
  return {
    sensor_id: id,
    name,
    sensor_type: sensorType,
    category,
    zone,
    unit,
    status: 'ACTIVE',
    last_values: lastValues,
    last_battery_pct: 87,
    firmware_version: '1.4.2',
    last_seen_at: new Date(now - MIN).toISOString(),
  };
}

/** 22 sensores: 12 estructurales, 5 de consumo, 5 de CO₂. Solo zonas comunes. */
function baseSensors(now: number): Sensor[] {
  const list: Sensor[] = [];
  const towers = [
    [1, 'Torre 1'],
    [2, 'Torre 2'],
  ] as const;
  const levels = [
    ['sotano', 'Sótano'],
    ['cubierta', 'Cubierta'],
  ] as const;
  for (const [t, tower] of towers) {
    for (const [levelId, level] of levels) {
      const zone = `${level} ${tower}`;
      list.push(sensor(now, `acc-t${t}-${levelId}`, `Acelerómetro ${zone}`, 'accelerometer', 'structural', zone, 'g', { x: 0.002, y: 0.001, z: 0.998 }));
      list.push(sensor(now, `incl-t${t}-${levelId}`, `Inclinómetro ${zone}`, 'inclinometer', 'structural', zone, '°', { x: 0.02, y: 0.01 }));
      list.push(sensor(now, `crack-t${t}-${levelId}`, `Fisurómetro ${zone}`, 'crack_meter', 'structural', zone, 'mm', { width: 0.4 }));
    }
  }
  list.push(sensor(now, 'water-main', 'Medidor acueducto principal', 'water_flow', 'consumption', 'Cuarto de bombas', 'm³/h', { flow: 3.2 }));
  list.push(sensor(now, 'water-irrigation', 'Medidor riego zonas verdes', 'water_flow', 'consumption', 'Cuarto de bombas', 'm³/h', { flow: 0.6 }));
  list.push(sensor(now, 'power-elev-t1', 'Energía ascensores Torre 1', 'power', 'consumption', 'Cuarto de máquinas Torre 1', 'kW', { power: 7.4 }));
  list.push(sensor(now, 'power-elev-t2', 'Energía ascensores Torre 2', 'power', 'consumption', 'Cuarto de máquinas Torre 2', 'kW', { power: 6.9 }));
  list.push(sensor(now, 'power-common', 'Energía iluminación zonas comunes', 'power', 'consumption', 'Subestación', 'kW', { power: 4.1 }));
  const co2: [string, string, number][] = [
    ['co2-gym', 'Gimnasio', 650],
    ['co2-salon', 'Salón social', 720],
    ['co2-lobby-t1', 'Lobby Torre 1', 540],
    ['co2-lobby-t2', 'Lobby Torre 2', 560],
    ['co2-parking', 'Parqueadero sótano', 780],
  ];
  for (const [id, zone, ppm] of co2) {
    list.push(sensor(now, id, `CO₂ ${zone}`, 'co2', 'comfort', zone, 'ppm', { co2: ppm }));
  }
  return list;
}

type AlertSeed = Pick<AlertAdmin, 'sensor_id' | 'level' | 'category' | 'message'> & Partial<AlertAdmin>;

function alert(now: number, seq: number, minutesAgo: number, fields: AlertSeed): AlertAdmin {
  const timestamp = new Date(now - minutesAgo * MIN);
  const ymd = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
  return {
    alert_id: `alrt-${ymd}-${String(seq).padStart(5, '0')}`,
    building_id: BUILDING_ID,
    timestamp: timestamp.toISOString(),
    acknowledged: false,
    value_triggered: null,
    threshold_configured: null,
    occurrence_count: 1,
    acknowledged_by: null,
    acknowledged_at: null,
    ...fields,
  };
}

export function createSeed(scenario: Scenario, now: number): { sensors: Sensor[]; alerts: AlertAdmin[] } {
  if (scenario === 'vacio') return { sensors: [], alerts: [] };

  const sensors = baseSensors(now);
  const alerts: AlertAdmin[] = [
    alert(now, 1, 180, { sensor_id: 'co2-gym', level: 'INFO', category: 'comfort', message: 'Batería por debajo del 20 %', value_triggered: 18, threshold_configured: 20 }),
    alert(now, 2, 240, { sensor_id: 'co2-parking', level: 'INFO', category: 'comfort', message: 'Batería por debajo del 20 %', value_triggered: 15, threshold_configured: 20 }),
    alert(now, 3, 300, {
      sensor_id: 'water-main',
      level: 'WARNING',
      category: 'consumption',
      message: 'Caudal superior al umbral configurado',
      value_triggered: 6.1,
      threshold_configured: 5,
      acknowledged: true,
      acknowledged_by: 'usr-admin-01',
      acknowledged_at: new Date(now - 60 * MIN).toISOString(),
    }),
  ];

  const setOffline = (id: string) => {
    const target = sensors.find((s) => s.sensor_id === id);
    if (target) target.last_seen_at = new Date(now - 40 * MIN).toISOString();
  };

  if (scenario === 'critico') {
    alerts.push(
      alert(now, 4, 4, {
        sensor_id: 'acc-t1-sotano',
        level: 'CRITICAL',
        category: 'structural',
        message: 'Aceleración superior al umbral configurado',
        value_triggered: 0.35,
        threshold_configured: 0.2,
        occurrence_count: 12,
      }),
      alert(now, 5, 25, {
        sensor_id: 'crack-t2-cubierta',
        level: 'WARNING',
        category: 'structural',
        message: 'Cambio medido en la apertura de fisura',
        value_triggered: 0.9,
        threshold_configured: 0.8,
      }),
    );
    setOffline('incl-t2-sotano');
    const salon = sensors.find((s) => s.sensor_id === 'co2-salon');
    if (salon) salon.last_values = { co2: 1450 };
  }

  if (scenario === 'caido') {
    ['acc-t2-sotano', 'incl-t2-sotano', 'crack-t2-sotano', 'acc-t2-cubierta', 'incl-t2-cubierta', 'crack-t2-cubierta'].forEach(setOffline);
  }

  return { sensors, alerts };
}
```

`apps/web/src/mocks/db.ts`:
```ts
import type { AlertAdmin, Sensor } from '@gd/api';
import { USERS, createSeed, type MockUser, type Scenario } from './seed';

interface LoginAttempts {
  count: number;
  lockedUntil: number | null;
}

export interface MockDb {
  scenario: Scenario;
  users: MockUser[];
  sensors: Sensor[];
  alerts: AlertAdmin[];
  usedRefreshTokens: Set<string>;
  loginAttempts: Map<string, LoginAttempts>;
  settings: {
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    /** Tokens emitidos antes de este instante (ms) se rechazan. */
    accessValidAfterMs: number;
    refreshValidAfterMs: number;
  };
}

function createDb(scenario: Scenario, now: number): MockDb {
  const seed = createSeed(scenario, now);
  return {
    scenario,
    users: USERS,
    sensors: seed.sensors,
    alerts: seed.alerts,
    usedRefreshTokens: new Set(),
    loginAttempts: new Map(),
    settings: { accessTtlSeconds: 900, refreshTtlSeconds: 7 * 24 * 3600, accessValidAfterMs: 0, refreshValidAfterMs: 0 },
  };
}

export const db: MockDb = createDb('sano', Date.now());

export function resetDb(scenario: Scenario = 'sano', now = Date.now()): void {
  Object.assign(db, createDb(scenario, now));
}
```

- [ ] **Step 5: Implementar autenticación simulada y handlers**

`apps/web/src/mocks/auth.ts`:
```ts
import type { Role } from '@gd/api';
import { makeFakeJwt, readFakeJwt } from '@gd/api/testing';
import { HttpResponse } from 'msw';
import { db } from './db';
import type { MockUser } from './seed';

export interface MockClaims {
  sub: string;
  role: Role;
  buildingId: string;
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: unknown = null,
  headers: Record<string, string> = {},
) {
  return HttpResponse.json({ error: { code, message, details } }, { status, headers });
}

/** Tokens sin estado (sobreviven a recargar la página); la invalidación usa `iat_ms`. */
export function issueTokens(user: MockUser) {
  const nowMs = Date.now();
  const iat = Math.floor(nowMs / 1000);
  const accessToken = makeFakeJwt({
    sub: user.id,
    role: user.role,
    buildingId: user.buildingId,
    iat,
    exp: iat + db.settings.accessTtlSeconds,
    iat_ms: nowMs,
  });
  const refreshToken = makeFakeJwt({
    sub: user.id,
    typ: 'refresh',
    jti: crypto.randomUUID(),
    exp: iat + db.settings.refreshTtlSeconds,
    iat_ms: nowMs,
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: db.settings.accessTtlSeconds,
  };
}

export function authenticate(request: Request): MockClaims | Response {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? readFakeJwt(token) : null;
  if (!payload || payload.typ === 'refresh') return errorResponse(401, 'UNAUTHORIZED', 'Se requiere autenticación');
  const expired = !(Number(payload.exp) * 1000 > Date.now());
  const revoked = !(Number(payload.iat_ms) >= db.settings.accessValidAfterMs);
  if (expired || revoked) return errorResponse(401, 'TOKEN_EXPIRED', 'El token expiró');
  return { sub: String(payload.sub), role: payload.role as Role, buildingId: String(payload.buildingId) };
}

export function requireRole(claims: MockClaims, roles: Role[]): Response | null {
  return roles.includes(claims.role) ? null : errorResponse(403, 'FORBIDDEN', 'No tienes permiso para este recurso');
}

/** Valida y consume un refresh token (rotación: cada uno sirve una sola vez). */
export function consumeRefreshToken(token: string): MockUser | null {
  const payload = readFakeJwt(token);
  if (!payload || payload.typ !== 'refresh') return null;
  const jti = String(payload.jti);
  if (db.usedRefreshTokens.has(jti)) return null;
  if (!(Number(payload.exp) * 1000 > Date.now())) return null;
  if (!(Number(payload.iat_ms) >= db.settings.refreshValidAfterMs)) return null;
  db.usedRefreshTokens.add(jti);
  return db.users.find((u) => u.id === payload.sub) ?? null;
}
```

`apps/web/src/mocks/handlers/auth.ts`:
```ts
import { HttpResponse, http } from 'msw';
import { consumeRefreshToken, errorResponse, issueTokens } from '../auth';
import { db } from '../db';
import { RATE_LIMITED_EMAIL } from '../seed';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

export const authHandlers = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = String(body.email ?? '').trim().toLowerCase();

    if (email === RATE_LIMITED_EMAIL) {
      return errorResponse(429, 'RATE_LIMITED', 'Demasiadas solicitudes', null, { 'Retry-After': '30' });
    }

    const attempts = db.loginAttempts.get(email) ?? { count: 0, lockedUntil: null };
    if (attempts.lockedUntil !== null && attempts.lockedUntil > Date.now()) {
      return errorResponse(423, 'ACCOUNT_LOCKED', 'Cuenta bloqueada temporalmente');
    }

    const user = db.users.find((u) => u.email === email);
    if (!user || user.password !== body.password) {
      attempts.count += 1;
      if (attempts.count >= MAX_ATTEMPTS) {
        db.loginAttempts.set(email, { count: 0, lockedUntil: Date.now() + LOCK_MS });
        return errorResponse(423, 'ACCOUNT_LOCKED', 'Cuenta bloqueada temporalmente');
      }
      db.loginAttempts.set(email, attempts);
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas');
    }

    db.loginAttempts.delete(email);
    return HttpResponse.json({
      ...issueTokens(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  }),

  http.post('*/api/v1/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refresh_token?: unknown };
    const user = consumeRefreshToken(String(body.refresh_token ?? ''));
    if (!user) return errorResponse(401, 'INVALID_REFRESH_TOKEN', 'Sesión expirada');
    return HttpResponse.json(issueTokens(user));
  }),

  http.post('*/api/v1/auth/logout', async ({ request }) => {
    const body = (await request.json()) as { refresh_token?: unknown };
    consumeRefreshToken(String(body.refresh_token ?? ''));
    return new HttpResponse(null, { status: 204 });
  }),
];
```

`apps/web/src/mocks/handlers/dashboard.ts`:
```ts
import type { AlertAdmin } from '@gd/api';
import { isOffline } from '@gd/domain';
import { HttpResponse, http } from 'msw';
import { authenticate } from '../auth';
import { db } from '../db';

function co2Index(ppm: number): 'BUENO' | 'REGULAR' | 'MALO' {
  if (ppm < 800) return 'BUENO';
  if (ppm <= 1200) return 'REGULAR';
  return 'MALO';
}

export const dashboardHandlers = [
  http.get('*/api/v1/dashboard/general', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const now = new Date();
    const open = db.alerts.filter((a) => !a.acknowledged);
    const count = (level: AlertAdmin['level']) => open.filter((a) => a.level === level).length;
    const critical = count('CRITICAL');
    const warning = count('WARNING');
    const info = count('INFO');
    const offline = db.sensors.filter((s) => isOffline(s.last_seen_at, now)).length;
    return HttpResponse.json({
      health_score: Math.max(0, 100 - (25 * critical + 10 * warning + 2 * info + 5 * offline)),
      alerts_summary: { CRITICAL: critical, WARNING: warning, INFO: info, total: critical + warning + info },
      sensors: { total: db.sensors.length, online: db.sensors.length - offline, offline },
      generated_at: now.toISOString(),
    });
  }),

  http.get('*/api/v1/dashboard/comfort', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const zones = db.sensors
      .filter((s) => s.category === 'comfort' && typeof s.last_values?.co2 === 'number')
      .map((s) => {
        const ppm = s.last_values?.co2 ?? 0;
        const zone = { zone: s.zone, index: co2Index(ppm), sensors: [s.sensor_id] };
        return auth.role === 'ADMIN' ? { ...zone, ppm } : zone;
      });
    return HttpResponse.json({ zones });
  }),
];
```

`apps/web/src/mocks/handlers/alerts.ts`:
```ts
import type { AlertAdmin, AlertResidente } from '@gd/api';
import { HttpResponse, http } from 'msw';
import { authenticate } from '../auth';
import { db } from '../db';

function toResidente(alert: AlertAdmin): AlertResidente {
  const { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged } = alert;
  return { alert_id, building_id, sensor_id, level, category, message, timestamp, acknowledged };
}

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
    const data = auth.role === 'ADMIN' ? list : list.map(toResidente);
    return HttpResponse.json({ count: data.length, data });
  }),
];
```

`apps/web/src/mocks/handlers/sensors.ts`:
```ts
import { HttpResponse, http } from 'msw';
import { authenticate, requireRole } from '../auth';
import { db } from '../db';

export const sensorHandlers = [
  http.get('*/api/v1/sensors', ({ request }) => {
    const auth = authenticate(request);
    if (auth instanceof Response) return auth;
    const forbidden = requireRole(auth, ['ADMIN']);
    if (forbidden) return forbidden;
    return HttpResponse.json({ count: db.sensors.length, data: db.sensors });
  }),
];
```

`apps/web/src/mocks/handlers/index.ts`:
```ts
import { alertHandlers } from './alerts';
import { authHandlers } from './auth';
import { dashboardHandlers } from './dashboard';
import { sensorHandlers } from './sensors';

export const handlers = [...authHandlers, ...dashboardHandlers, ...alertHandlers, ...sensorHandlers];
```

`apps/web/src/mocks/server.ts`:
```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

`apps/web/src/mocks/browser.ts`:
```ts
import { setupWorker } from 'msw/browser';
import { db, resetDb } from './db';
import { handlers } from './handlers';
import { isScenario, type Scenario } from './seed';

declare global {
  interface Window {
    __gdMocks?: {
      expireAccessTokens(): void;
      revokeRefreshTokens(): void;
      reset(scenario?: Scenario): void;
    };
  }
}

const SCENARIO_KEY = 'gd.mock.escenario';

/** `?escenario=` en la URL tiene prioridad y se recuerda en la pestaña. */
function pickScenario(): Scenario {
  const fromUrl = new URLSearchParams(window.location.search).get('escenario');
  try {
    if (isScenario(fromUrl)) {
      window.sessionStorage.setItem(SCENARIO_KEY, fromUrl);
      return fromUrl;
    }
    const saved = window.sessionStorage.getItem(SCENARIO_KEY);
    return isScenario(saved) ? saved : 'sano';
  } catch {
    return isScenario(fromUrl) ? fromUrl : 'sano';
  }
}

export async function startMockWorker(): Promise<void> {
  resetDb(pickScenario());
  window.__gdMocks = {
    expireAccessTokens: () => {
      db.settings.accessValidAfterMs = Date.now() + 1;
    },
    revokeRefreshTokens: () => {
      db.settings.refreshValidAfterMs = Date.now() + 1;
    },
    reset: (scenario) => resetDb(scenario),
  };
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true });
}
```

Reemplazar `apps/web/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetDb } from '../mocks/db';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  window.sessionStorage.clear();
});
afterAll(() => server.close());
```

- [ ] **Step 6: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (incluidos los tests de Task 9).

- [ ] **Step 7: Commit**

```
git add apps/web
git commit -m "feat(web): backend simulado con MSW, seed determinista y escenarios"
```

---

### Task 11: Sesión en la web y pantalla de inicio de sesión

**Files:**
- Create: `apps/web/src/app/config.ts`, `apps/web/src/app/services.ts`, `apps/web/src/app/AppProviders.tsx`
- Create: `apps/web/src/app/session/SessionStorageTokenStore.ts`, `apps/web/src/app/session/SessionProvider.tsx`
- Create: `apps/web/src/app/pages/SplashScreen.tsx`
- Create: `apps/web/src/features/auth/safeRedirect.ts`, `loginErrorMessage.ts`, `LoginForm.tsx`, `LoginPage.tsx`, `LoginPage.module.css`
- Create: `apps/web/src/test/renderApp.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/app/session/SessionStorageTokenStore.test.ts`, `apps/web/src/features/auth/safeRedirect.test.ts`, `apps/web/src/features/auth/loginErrorMessage.test.ts`, `apps/web/src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `createSessionManager`, `createHttpClient`, `createApi`, `MemoryTokenStore`, `TokenStore`, `ValidationMode`, `ContractDrift`, `ApiError`, `ContractDriftError`, `sessionUserSchema`, `Session` (`@gd/api`); `ApiProvider` (`@gd/query`); `useNow`, `Button` (Task 9); mocks (Task 10).
- Produces:
  - `config: { useMocks: boolean; apiBaseUrl: string; validation: ValidationMode }`
  - `interface Services { session: SessionManager; api: Api; queryClient: QueryClient }`
  - `createServices(options: { baseUrl: string; store: TokenStore; validation: ValidationMode; onContractDrift?: (d: ContractDrift) => void; queryClient?: QueryClient }): Services`
  - `class SessionStorageTokenStore implements TokenStore` con `constructor(storage: Storage | null)`; `getSessionStorage(): Storage | null`
  - `type SessionStatus = 'restoring' | 'authenticated' | 'anonymous' | 'expired'`
  - `SessionProvider({ manager, children })`; `useSession(): { status: SessionStatus; session: Session | null; login(email, password): Promise<Session>; logout(): Promise<void> }` (en `expired`, `session` conserva la última sesión para pintar la UI)
  - `AppProviders({ services, children })`
  - `safeRedirect(target: string | null): string`; `loginErrorMessage(error: unknown): string`
  - `LoginForm({ onSuccess(session: Session): void; defaultEmail?: string })`; `LoginPage()`; `SplashScreen()`
  - Test helpers (`test/renderApp.tsx`): `createTestServices(): Services` (base `http://localhost`, `MemoryTokenStore`, validación estricta, sin reintentos) y `loginAs(services, who: 'admin' | 'residente'): Promise<void>`. `renderApp` se añade en Task 12.

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/app/session/SessionStorageTokenStore.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SessionStorageTokenStore } from './SessionStorageTokenStore';

const user = { id: 'usr-1', email: 'admin@demo.co', name: 'Admin', role: 'ADMIN' as const };

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('bloqueado', 'SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail, clear: fail, key: fail, length: 0 } as unknown as Storage;
}

describe('SessionStorageTokenStore', () => {
  it('persiste refresh y usuario en sessionStorage', () => {
    const store = new SessionStorageTokenStore(window.sessionStorage);
    store.setRefreshToken('r-1');
    store.setUser(user);
    const other = new SessionStorageTokenStore(window.sessionStorage);
    expect(other.getRefreshToken()).toBe('r-1');
    expect(other.getUser()?.email).toBe('admin@demo.co');
  });

  it('si el storage lanza, sigue funcionando en memoria', () => {
    const store = new SessionStorageTokenStore(throwingStorage());
    store.setRefreshToken('r-1');
    store.setUser(user);
    expect(store.getRefreshToken()).toBe('r-1');
    expect(store.getUser()?.name).toBe('Admin');
  });

  it('sin storage disponible (null) funciona en memoria', () => {
    const store = new SessionStorageTokenStore(null);
    store.setRefreshToken('r-1');
    expect(store.getRefreshToken()).toBe('r-1');
  });

  it('ignora un usuario corrupto', () => {
    window.sessionStorage.setItem('gd.user', '{no-json');
    expect(new SessionStorageTokenStore(window.sessionStorage).getUser()).toBeNull();
  });
});
```

`apps/web/src/features/auth/safeRedirect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safeRedirect';

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/aire')).toBe('/aire');
    expect(safeRedirect('/alertas?nivel=CRITICAL')).toBe('/alertas?nivel=CRITICAL');
  });
  it.each([null, '', '//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/login'])(
    'rechaza %s y vuelve al inicio',
    (target) => {
      expect(safeRedirect(target)).toBe('/');
    },
  );
});
```

`apps/web/src/features/auth/loginErrorMessage.test.ts`:
```ts
import { ApiError } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './loginErrorMessage';

const err = (status: number, code = `HTTP_${status}`) => new ApiError({ status, code, message: 'x' });

describe('loginErrorMessage', () => {
  it('credenciales incorrectas → mensaje genérico (no revela si el correo existe)', () => {
    expect(loginErrorMessage(err(401))).toBe('Correo o contraseña incorrectos.');
  });
  it('cuenta bloqueada por 423 o por código', () => {
    expect(loginErrorMessage(err(423))).toMatch(/bloqueada temporalmente.*15 minutos/);
    expect(loginErrorMessage(err(403, 'ACCOUNT_LOCKED'))).toMatch(/bloqueada temporalmente/);
  });
  it('rate limit, red y otros', () => {
    expect(loginErrorMessage(err(429))).toMatch(/Demasiados intentos/);
    expect(loginErrorMessage(err(0))).toMatch(/No se pudo conectar/);
    expect(loginErrorMessage(err(500))).toBe('No pudimos iniciar sesión. Intenta de nuevo.');
  });
});
```

`apps/web/src/features/auth/LoginPage.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { ADMIN_EMAIL, DEMO_PASSWORD } from '../../mocks/seed';
import { createTestServices } from '../../test/renderApp';
import { LoginPage } from './LoginPage';

function Where() {
  const location = useLocation();
  return <p>Ruta actual: {location.pathname}</p>;
}

function renderLogin(route: string) {
  const services = createTestServices();
  render(
    <AppProviders services={services}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
  return services;
}

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Correo electrónico'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  it('muestra error con credenciales incorrectas y limpia la contraseña', async () => {
    renderLogin('/login');
    await submit(ADMIN_EMAIL, 'mala');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('pide ambos campos antes de llamar al backend', async () => {
    renderLogin('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe tu correo y tu contraseña.');
  });

  it('al entrar redirige a la ruta de "volver"', async () => {
    renderLogin('/login?volver=%2Faire');
    await submit(ADMIN_EMAIL, DEMO_PASSWORD);
    expect(await screen.findByText('Ruta actual: /aire')).toBeInTheDocument();
  });

  it('ignora un "volver" externo', async () => {
    renderLogin('/login?volver=%2F%2Fevil.com');
    await submit(ADMIN_EMAIL, DEMO_PASSWORD);
    expect(await screen.findByText('Ruta actual: /')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 3: Implementar sesión, servicios y providers**

`apps/web/src/app/config.ts`:
```ts
import type { ValidationMode } from '@gd/api';

export const config: { useMocks: boolean; apiBaseUrl: string; validation: ValidationMode } = {
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  validation: import.meta.env.DEV ? 'strict' : 'lenient',
};
```

`apps/web/src/app/session/SessionStorageTokenStore.ts`:
```ts
import { MemoryTokenStore, sessionUserSchema, type SessionUser, type TokenStore } from '@gd/api';

const REFRESH_KEY = 'gd.refresh_token';
const USER_KEY = 'gd.user';

export function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** sessionStorage con respaldo en memoria si el navegador lo bloquea o lanza. */
export class SessionStorageTokenStore implements TokenStore {
  private readonly memory = new MemoryTokenStore();
  private storage: Storage | null;

  constructor(storage: Storage | null) {
    this.storage = storage;
  }

  private attempt<T>(operation: (storage: Storage) => T, fallback: () => T): T {
    if (!this.storage) return fallback();
    try {
      return operation(this.storage);
    } catch {
      this.storage = null;
      return fallback();
    }
  }

  getRefreshToken(): string | null {
    return this.attempt(
      (s) => s.getItem(REFRESH_KEY),
      () => this.memory.getRefreshToken(),
    );
  }

  setRefreshToken(token: string | null): void {
    this.memory.setRefreshToken(token);
    this.attempt(
      (s) => (token === null ? s.removeItem(REFRESH_KEY) : s.setItem(REFRESH_KEY, token)),
      () => undefined,
    );
  }

  getUser(): SessionUser | null {
    return this.attempt(
      (s) => {
        const raw = s.getItem(USER_KEY);
        if (!raw) return null;
        try {
          const parsed = sessionUserSchema.safeParse(JSON.parse(raw));
          return parsed.success ? parsed.data : null;
        } catch {
          return null;
        }
      },
      () => this.memory.getUser(),
    );
  }

  setUser(user: SessionUser | null): void {
    this.memory.setUser(user);
    this.attempt(
      (s) => (user === null ? s.removeItem(USER_KEY) : s.setItem(USER_KEY, JSON.stringify(user))),
      () => undefined,
    );
  }
}
```

`apps/web/src/app/services.ts`:
```ts
import {
  ApiError,
  ContractDriftError,
  createApi,
  createHttpClient,
  createSessionManager,
  type Api,
  type ContractDrift,
  type SessionManager,
  type TokenStore,
  type ValidationMode,
} from '@gd/api';
import { QueryClient } from '@tanstack/react-query';

export interface Services {
  session: SessionManager;
  api: Api;
  queryClient: QueryClient;
}

export interface ServicesOptions {
  baseUrl: string;
  store: TokenStore;
  validation: ValidationMode;
  onContractDrift?: (drift: ContractDrift) => void;
  queryClient?: QueryClient;
}

const NO_RETRY_STATUS = new Set([401, 403, 404, 422]);

function defaultQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: (failureCount, error) => {
          if (error instanceof ContractDriftError) return false;
          if (error instanceof ApiError && NO_RETRY_STATUS.has(error.status)) return false;
          return failureCount < 2;
        },
      },
    },
  });
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
  return { session, api: createApi(http), queryClient: options.queryClient ?? defaultQueryClient() };
}
```

`apps/web/src/app/session/SessionProvider.tsx`:
```tsx
import type { Session, SessionManager } from '@gd/api';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type SessionStatus = 'restoring' | 'authenticated' | 'anonymous' | 'expired';

interface SessionContextValue {
  status: SessionStatus;
  /** En 'expired' conserva la última sesión para seguir pintando la UI detrás del modal. */
  session: Session | null;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface State {
  status: SessionStatus;
  session: Session | null;
}

export function SessionProvider({ manager, children }: { manager: SessionManager; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ status: 'restoring', session: null });
  const lastSubRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = manager.subscribe((next, reason) => {
      setState((prev) => {
        if (next) return { status: 'authenticated', session: next };
        if (reason === 'expired' && prev.session) return { status: 'expired', session: prev.session };
        return { status: 'anonymous', session: null };
      });
    });
    let cancelled = false;
    void manager.restore().then((restored) => {
      if (cancelled || restored) return;
      setState((prev) => (prev.status === 'restoring' ? { status: 'anonymous', session: null } : prev));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [manager]);

  useEffect(() => {
    if (state.status === 'authenticated' && state.session) lastSubRef.current = state.session.claims.sub;
  }, [state]);

  const login = useCallback(
    async (email: string, password: string) => {
      const previousSub = lastSubRef.current;
      const session = await manager.login(email, password);
      if (previousSub !== null && previousSub !== session.claims.sub) queryClient.clear();
      return session;
    },
    [manager, queryClient],
  );

  const logout = useCallback(async () => {
    await manager.logout();
    lastSubRef.current = null;
    queryClient.clear();
  }, [manager, queryClient]);

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return value;
}
```

`apps/web/src/app/AppProviders.tsx`:
```tsx
import { ApiProvider } from '@gd/query';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Services } from './services';
import { SessionProvider } from './session/SessionProvider';

export function AppProviders({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <QueryClientProvider client={services.queryClient}>
      <ApiProvider api={services.api}>
        <SessionProvider manager={services.session}>{children}</SessionProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
```

`apps/web/src/app/pages/SplashScreen.tsx`:
```tsx
export function SplashScreen() {
  return (
    <div role="status" aria-live="polite" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      Cargando tu sesión…
    </div>
  );
}
```

- [ ] **Step 4: Implementar el login y los helpers de prueba**

`apps/web/src/features/auth/safeRedirect.ts`:
```ts
/** Evita redirecciones abiertas: solo rutas internas que empiezan por una sola "/". */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/')) return '/';
  if (target.startsWith('//') || target.startsWith('/\\')) return '/';
  if (target === '/login' || target.startsWith('/login?')) return '/';
  return target;
}
```

`apps/web/src/features/auth/loginErrorMessage.ts`:
```ts
import { ApiError } from '@gd/api';

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 423 || error.code === 'ACCOUNT_LOCKED') {
      return 'Tu cuenta está bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en 15 minutos.';
    }
    if (error.status === 401) return 'Correo o contraseña incorrectos.';
    if (error.status === 429) return 'Demasiados intentos. Espera unos segundos e inténtalo de nuevo.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }
  return 'No pudimos iniciar sesión. Intenta de nuevo.';
}
```

`apps/web/src/features/auth/LoginForm.tsx`:
```tsx
import { ApiError, type Session } from '@gd/api';
import { useState, type FormEvent } from 'react';
import { useSession } from '../../app/session/SessionProvider';
import { Button } from '../../ui/Button';
import { useNow } from '../../ui/useNow';
import styles from './LoginPage.module.css';
import { loginErrorMessage } from './loginErrorMessage';

interface LoginFormProps {
  onSuccess: (session: Session) => void;
  defaultEmail?: string;
}

export function LoginForm({ onSuccess, defaultEmail = '' }: LoginFormProps) {
  const { login } = useSession();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const now = useNow(1000);
  const waitSeconds = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now.getTime()) / 1000));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(email.trim(), password);
      onSuccess(session);
    } catch (err) {
      setError(loginErrorMessage(err));
      if (err instanceof ApiError && err.status === 429) {
        setRetryAt(Date.now() + (err.retryAfterSeconds ?? 30) * 1000);
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="login-email">Correo electrónico</label>
      <input
        id="login-email"
        type="email"
        autoComplete="username"
        autoFocus={!defaultEmail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label htmlFor="login-password">Contraseña</label>
      <input
        id="login-password"
        type="password"
        autoComplete="current-password"
        autoFocus={Boolean(defaultEmail)}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
          {waitSeconds > 0 && ` Podrás intentarlo en ${waitSeconds} s.`}
        </p>
      )}
      <Button type="submit" disabled={submitting || waitSeconds > 0}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  );
}
```

`apps/web/src/features/auth/LoginPage.module.css`:
```css
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-4);
}
.card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-8) var(--space-6);
}
.card h1 { margin: 0 0 var(--space-2); font-size: 1.5rem; }
.card > p { margin: 0 0 var(--space-6); color: var(--text-muted); }
.form { display: grid; gap: var(--space-2); }
.form input {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  margin-bottom: var(--space-2);
}
.error {
  margin: 0 0 var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--status-critical-bg);
  color: var(--status-critical-fg);
}
```

`apps/web/src/features/auth/LoginPage.tsx`:
```tsx
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { SplashScreen } from '../../app/pages/SplashScreen';
import { useSession } from '../../app/session/SessionProvider';
import { LoginForm } from './LoginForm';
import styles from './LoginPage.module.css';
import { safeRedirect } from './safeRedirect';

export function LoginPage() {
  const { status } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const target = safeRedirect(params.get('volver'));

  if (status === 'restoring') return <SplashScreen />;
  if (status === 'authenticated') return <Navigate to={target} replace />;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Gemelo Digital</h1>
        <p>Ingresa para ver el estado de tu conjunto.</p>
        <LoginForm onSuccess={() => navigate(target, { replace: true })} />
      </div>
    </main>
  );
}
```

`apps/web/src/test/renderApp.tsx` (en Task 12 se añade `renderApp`):
```tsx
import { MemoryTokenStore } from '@gd/api';
import { QueryClient } from '@tanstack/react-query';
import { createServices, type Services } from '../app/services';
import { ADMIN_EMAIL, DEMO_PASSWORD, RESIDENTE_EMAIL } from '../mocks/seed';

export function createTestServices(): Services {
  return createServices({
    baseUrl: 'http://localhost',
    store: new MemoryTokenStore(),
    validation: 'strict',
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
}

export async function loginAs(services: Services, who: 'admin' | 'residente'): Promise<void> {
  await services.session.login(who === 'admin' ? ADMIN_EMAIL : RESIDENTE_EMAIL, DEMO_PASSWORD);
}
```

Reemplazar `apps/web/src/main.tsx` (en Task 12 se cambia el contenido renderizado por `<AppRoutes />`):
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { config } from './app/config';
import { createServices } from './app/services';
import { SessionStorageTokenStore, getSessionStorage } from './app/session/SessionStorageTokenStore';
import { LoginPage } from './features/auth/LoginPage';
import './ui/tokens.css';

async function start() {
  if (config.useMocks) {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
  }
  const services = createServices({
    baseUrl: config.apiBaseUrl,
    store: new SessionStorageTokenStore(getSessionStorage()),
    validation: config.validation,
    onContractDrift: (drift) => console.warn('[contrato] respuesta fuera de contrato', drift),
  });
  const root = document.getElementById('root');
  if (!root) throw new Error('No se encontró #root');
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <AppProviders services={services}>
          <Routes>
            <Route path="*" element={<LoginPage />} />
          </Routes>
        </AppProviders>
      </BrowserRouter>
    </StrictMode>,
  );
}

void start();
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 6: Verificación manual rápida**

Run: `pnpm dev` y abrir `http://localhost:5173/login`.
Expected: el formulario aparece; `admin@demo.co` / `Demo1234!` entra sin errores en consola (la pantalla siguiente aún es el login porque las rutas llegan en Task 12). Detener el servidor.

- [ ] **Step 7: Commit**

```
git add apps/web
git commit -m "feat(web): sesión con sessionStorage y pantalla de inicio de sesión"
```

---

### Task 12: Rutas, shell por rol, guardas y modal de re-login

**Files:**
- Create: `apps/web/src/app/routes.tsx`
- Create: `apps/web/src/app/guards/RequireAuth.tsx`, `apps/web/src/app/guards/RequireRole.tsx`
- Create: `apps/web/src/app/layout/navItems.ts`, `AppShell.tsx`, `AppShell.module.css`, `Header.tsx`, `Sidebar.tsx`
- Create: `apps/web/src/app/pages/ForbiddenPage.tsx`, `NotFoundPage.tsx`, `PendingSection.tsx`
- Create: `apps/web/src/features/auth/ReloginModal.tsx`, `apps/web/src/features/auth/ReloginModal.module.css`
- Modify: `apps/web/src/test/renderApp.tsx`, `apps/web/src/main.tsx`
- Test: `apps/web/src/app/routes.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `SplashScreen`, `LoginPage`, `LoginForm`, `Services`, `AppProviders` (Task 11); `Role` (`@gd/api`).
- Produces:
  - `interface NavItem { to: string; label: string; Icon: LucideIcon; roles: Role[] }`; `NAV_ITEMS: NavItem[]`; `navItemsFor(role: Role): NavItem[]`
  - `AppRoutes()` con: `/login`; dentro de `RequireAuth` + `AppShell`: `/` (index), `/alertas`, `/aire` (ambos roles), y bajo `RequireRole roles={['ADMIN']}`: `/estructural`, `/consumos`, `/gemelo`, `/sensores`, `/mantenimiento`, `/reportes`; `*` → `NotFoundPage`
  - `RequireAuth({ children })`; `RequireRole({ roles })` (ruta de layout con `<Outlet />`)
  - `PendingSection({ title })` (marcador temporal que reemplazan los Planes 2–5)
  - `renderApp(services: Services, route?: string)` en `test/renderApp.tsx`

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/app/routes.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../mocks/db';
import { DEMO_PASSWORD } from '../mocks/seed';
import { createTestServices, loginAs, renderApp } from '../test/renderApp';

describe('rutas y guardas', () => {
  it('sin sesión redirige al login conservando la ruta pedida', async () => {
    const services = createTestServices();
    renderApp(services, '/aire');
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('el residente ve solo sus secciones en el menú', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/aire');
    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('link', { name: 'Calidad del aire' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Sensores' })).not.toBeInTheDocument();
  });

  it('el residente que entra a una ruta de administrador ve "sin permiso"', async () => {
    const services = createTestServices();
    await loginAs(services, 'residente');
    renderApp(services, '/sensores');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('el administrador ve todas las secciones', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/sensores');
    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getAllByRole('link')).toHaveLength(9);
    expect(screen.getByRole('heading', { name: 'Sensores' })).toBeInTheDocument();
  });

  it('ruta desconocida muestra "Página no encontrada"', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/no-existe');
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });

  it('si la sesión expira, aparece el modal y al volver a entrar sigue en la misma pantalla', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/aire');
    await screen.findByRole('heading', { name: 'Calidad del aire' });

    db.settings.refreshValidAfterMs = Date.now() + 1;
    await new Promise((r) => setTimeout(r, 5));
    await services.session.refresh();

    const dialog = await screen.findByRole('dialog', { name: 'Tu sesión expiró' });
    expect(within(dialog).getByLabelText('Correo electrónico')).toHaveValue('admin@demo.co');
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), DEMO_PASSWORD);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ingresar' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Calidad del aire' })).toBeInTheDocument();
  });

  it('cerrar sesión vuelve al login', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/aire');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — `renderApp` no existe.

- [ ] **Step 3: Implementar páginas simples y guardas**

`apps/web/src/app/pages/PendingSection.tsx`:
```tsx
/** Marcador temporal: los Planes 2–5 reemplazan cada sección. */
export function PendingSection({ title }: { title: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <p>Esta sección se habilitará en una próxima entrega.</p>
    </section>
  );
}
```

`apps/web/src/app/pages/ForbiddenPage.tsx`:
```tsx
import { Link } from 'react-router';

export function ForbiddenPage() {
  return (
    <section>
      <h1>Sin permiso</h1>
      <p>No tienes permiso para ver esta sección.</p>
      <Link to="/">Volver al estado general</Link>
    </section>
  );
}
```

`apps/web/src/app/pages/NotFoundPage.tsx`:
```tsx
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section>
      <h1>Página no encontrada</h1>
      <p>La dirección que abriste no existe.</p>
      <Link to="/">Volver al estado general</Link>
    </section>
  );
}
```

`apps/web/src/app/guards/RequireAuth.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ReloginModal } from '../../features/auth/ReloginModal';
import { SplashScreen } from '../pages/SplashScreen';
import { useSession } from '../session/SessionProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'restoring') return <SplashScreen />;
  if (status === 'anonymous') {
    const volver = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }

  const expired = status === 'expired';
  return (
    <>
      <div inert={expired}>{children}</div>
      {expired && <ReloginModal />}
    </>
  );
}
```

`apps/web/src/app/guards/RequireRole.tsx`:
```tsx
import type { Role } from '@gd/api';
import { Outlet } from 'react-router';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { useSession } from '../session/SessionProvider';

/** Solo UX: la autorización real la hace el backend (que responde 403). */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { session } = useSession();
  if (!session || !roles.includes(session.claims.role)) return <ForbiddenPage />;
  return <Outlet />;
}
```

- [ ] **Step 4: Implementar el shell**

`apps/web/src/app/layout/navItems.ts`:
```ts
import type { Role } from '@gd/api';
import { Bell, Box, Building2, Cpu, FileText, Gauge, House, Wind, Wrench, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  roles: Role[];
}

const BOTH: Role[] = ['ADMIN', 'RESIDENTE'];
const ADMIN: Role[] = ['ADMIN'];

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Estado general', Icon: House, roles: BOTH },
  { to: '/alertas', label: 'Alertas', Icon: Bell, roles: BOTH },
  { to: '/estructural', label: 'Estructural', Icon: Building2, roles: ADMIN },
  { to: '/consumos', label: 'Consumos', Icon: Gauge, roles: ADMIN },
  { to: '/aire', label: 'Calidad del aire', Icon: Wind, roles: BOTH },
  { to: '/gemelo', label: 'Gemelo 3D', Icon: Box, roles: ADMIN },
  { to: '/sensores', label: 'Sensores', Icon: Cpu, roles: ADMIN },
  { to: '/mantenimiento', label: 'Mantenimiento', Icon: Wrench, roles: ADMIN },
  { to: '/reportes', label: 'Reportes', Icon: FileText, roles: ADMIN },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
```

`apps/web/src/app/layout/AppShell.module.css`:
```css
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 56px 1fr;
  grid-template-areas: 'header header' 'nav main';
}
.skip {
  position: absolute;
  left: -9999px;
}
.skip:focus {
  left: var(--space-4);
  top: var(--space-2);
  z-index: 10;
  background: var(--surface);
  padding: var(--space-2) var(--space-4);
}
.header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.brand { font-weight: 700; }
.user { display: flex; align-items: center; gap: var(--space-3); color: var(--text-muted); }
.nav {
  grid-area: nav;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: var(--space-2);
}
.nav ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
.link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: 0 var(--space-3);
  border-radius: var(--radius);
  color: var(--text);
  text-decoration: none;
}
.link[aria-current='page'] { background: var(--status-info-bg); color: var(--status-info-fg); font-weight: 600; }
.main { grid-area: main; padding: var(--space-6); min-width: 0; }

@media (max-width: 1023px) {
  .shell { grid-template-columns: 72px 1fr; }
  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .link { justify-content: center; padding: 0; }
}

@media (max-width: 767px) {
  .shell {
    grid-template-columns: 1fr;
    grid-template-rows: 56px 1fr auto;
    grid-template-areas: 'header' 'main' 'nav';
  }
  .nav {
    position: sticky;
    bottom: 0;
    border-right: none;
    border-top: 1px solid var(--border);
    overflow-x: auto;
  }
  .nav ul { grid-auto-flow: column; grid-auto-columns: minmax(56px, 1fr); }
  .main { padding: var(--space-4); }
}
```

`apps/web/src/app/layout/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router';
import { useSession } from '../session/SessionProvider';
import styles from './AppShell.module.css';
import { navItemsFor } from './navItems';

export function Sidebar() {
  const { session } = useSession();
  if (!session) return null;
  return (
    <nav className={styles.nav} aria-label="Secciones">
      <ul>
        {navItemsFor(session.claims.role).map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className={styles.link} title={label}>
              <Icon aria-hidden="true" size={20} />
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

`apps/web/src/app/layout/Header.tsx`:
```tsx
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../ui/Button';
import { useSession } from '../session/SessionProvider';
import styles from './AppShell.module.css';

const ROLE_LABEL = { ADMIN: 'Administración', RESIDENTE: 'Residente' } as const;

export function Header() {
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
        <span>
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
import { Outlet } from 'react-router';
import styles from './AppShell.module.css';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <Header />
      <Sidebar />
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Implementar el modal de re-login y las rutas**

`apps/web/src/features/auth/ReloginModal.module.css`:
```css
.backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgb(0 0 0 / 0.5);
  z-index: 100;
}
.dialog {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: var(--space-6);
}
.dialog h2 { margin: 0 0 var(--space-2); }
.dialog p { margin: 0 0 var(--space-4); color: var(--text-muted); }
.logout { margin-top: var(--space-3); width: 100%; }
```

`apps/web/src/features/auth/ReloginModal.tsx`:
```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session/SessionProvider';
import { Button } from '../../ui/Button';
import { LoginForm } from './LoginForm';
import styles from './ReloginModal.module.css';

export function ReloginModal() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previousSub = session?.claims.sub;

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="relogin-title">
        <h2 id="relogin-title">Tu sesión expiró</h2>
        <p>Vuelve a ingresar para continuar. Lo que estabas haciendo sigue en pantalla.</p>
        <LoginForm
          defaultEmail={session?.user?.email ?? ''}
          onSuccess={(next) => {
            if (next.claims.sub !== previousSub) navigate('/', { replace: true });
            else void queryClient.invalidateQueries();
          }}
        />
        <Button
          variant="secondary"
          className={styles.logout}
          onClick={() => {
            void logout().then(() => navigate('/login', { replace: true }));
          }}
        >
          Salir
        </Button>
      </div>
    </div>
  );
}
```

`apps/web/src/app/routes.tsx`:
```tsx
import { Route, Routes } from 'react-router';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './pages/NotFoundPage';
import { PendingSection } from './pages/PendingSection';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<PendingSection title="Estado general" />} />
        <Route path="alertas" element={<PendingSection title="Alertas" />} />
        <Route path="aire" element={<PendingSection title="Calidad del aire" />} />
        <Route element={<RequireRole roles={['ADMIN']} />}>
          <Route path="estructural" element={<PendingSection title="Estructural" />} />
          <Route path="consumos" element={<PendingSection title="Consumos" />} />
          <Route path="gemelo" element={<PendingSection title="Gemelo 3D" />} />
          <Route path="sensores" element={<PendingSection title="Sensores" />} />
          <Route path="mantenimiento" element={<PendingSection title="Mantenimiento" />} />
          <Route path="reportes" element={<PendingSection title="Reportes" />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
```

Añadir a `apps/web/src/test/renderApp.tsx`:
```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/routes';

export function renderApp(services: Services, route = '/') {
  return render(
    <AppProviders services={services}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}
```

En `apps/web/src/main.tsx`, reemplazar el bloque `<Routes>…</Routes>` por `<AppRoutes />`, eliminar los imports de `Route`, `Routes` y `LoginPage`, e importar `AppRoutes` desde `./app/routes`.

- [ ] **Step 6: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS.

- [ ] **Step 7: Verificación manual**

Run: `pnpm dev` → entrar como `residente@demo.co` y como `admin@demo.co`.
Expected: el menú cambia según el rol; en tablet (DevTools 820 px) el menú muestra solo iconos con nombre accesible; en móvil (390 px) pasa a la barra inferior; recargar la página mantiene la sesión. Detener el servidor.

- [ ] **Step 8: Commit**

```
git add apps/web
git commit -m "feat(web): rutas, shell por rol, guardas y modal de re-login"
```

---

### Task 13: Home "Estado general"

**Files:**
- Create: `apps/web/src/features/home/healthCopy.ts`, `HealthScoreCard.tsx`, `CriticalBanner.tsx`, `AlertKpis.tsx`, `SensorKpis.tsx`, `CategoryLinks.tsx`, `HomePage.tsx`, `Home.module.css`
- Modify: `apps/web/src/app/routes.tsx` (index → `HomePage`)
- Test: `apps/web/src/features/home/healthCopy.test.ts`, `apps/web/src/features/home/HomePage.test.tsx`

**Interfaces:**
- Consumes: `useDashboardGeneral`, `useAlerts`, `POLL_INTERVALS_MS` (`@gd/query`); `clampScore`, `healthBand`, `scoreBreakdown`, `isStale`, `formatNumber`, `HealthBand`, `ScoreDeduction`, `StatusLevel` (`@gd/domain`); `DashboardGeneral`, `Role` (`@gd/api`); `DataState`, `KpiCard`, `STATUS_META`, `useNow` (Task 9); `useSession` (Task 11).
- Produces:
  - `BAND_LABEL: Record<HealthBand, string>`; `BAND_TONE: Record<HealthBand, StatusLevel>`; `deductionText(d: ScoreDeduction): string`
  - `HomePage()`; `HealthScoreCard({ data: DashboardGeneral; now: Date })`; `CriticalBanner({ role: Role })`; `AlertKpis({ data })`; `SensorKpis({ data })`; `CategoryLinks({ role })`
  - Enlaces que usarán los Planes 2–5: `/alertas?alerta=<alert_id>` (una sola crítica) y `/alertas?nivel=CRITICAL&acusada=false` (varias)

- [ ] **Step 1: Escribir los tests que fallan**

`apps/web/src/features/home/healthCopy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { deductionText } from './healthCopy';

describe('deductionText', () => {
  it('usa singular y plural', () => {
    expect(deductionText({ reason: 'CRITICAL', count: 1, points: 25 })).toBe('1 alerta crítica');
    expect(deductionText({ reason: 'CRITICAL', count: 2, points: 50 })).toBe('2 alertas críticas');
    expect(deductionText({ reason: 'WARNING', count: 1, points: 10 })).toBe('1 advertencia');
    expect(deductionText({ reason: 'INFO', count: 2, points: 4 })).toBe('2 alertas informativas');
    expect(deductionText({ reason: 'OFFLINE', count: 1, points: 5 })).toBe('1 sensor sin datos');
  });
});
```

`apps/web/src/features/home/HomePage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { resetDb } from '../../mocks/db';
import { server } from '../../mocks/server';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

async function scoreRegion() {
  return within(await screen.findByRole('region', { name: 'Salud del edificio' }));
}

describe('HomePage', () => {
  it('escenario sano: puntaje, banda y desglose', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('96')).toBeInTheDocument();
    expect(region.getByText('Buen estado')).toBeInTheDocument();
    expect(region.getByText('−4 · 2 alertas informativas')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Alertas críticas sin revisar' })).not.toBeInTheDocument();
  });

  it('escenario crítico: banner con enlace directo a la alerta', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const banner = await screen.findByRole('region', { name: 'Alertas críticas sin revisar' });
    expect(within(banner).getByText('1 alerta crítica sin revisar')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Ver alerta' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/alertas\?alerta=alrt-\d{8}-00004$/),
    );
    const region = await scoreRegion();
    expect(await region.findByText('56')).toBeInTheDocument();
    expect(region.getByText('Requiere atención')).toBeInTheDocument();
  });

  it('el administrador ve sensores en línea y sin datos; el residente no', async () => {
    resetDb('critico');
    const admin = createTestServices();
    await loginAs(admin, 'admin');
    const { unmount } = renderApp(admin, '/');
    expect(await screen.findByText('Sensores sin datos')).toBeInTheDocument();
    unmount();

    const residente = createTestServices();
    await loginAs(residente, 'residente');
    renderApp(residente, '/');
    await scoreRegion();
    expect(await screen.findByText('Alertas críticas')).toBeInTheDocument();
    expect(screen.queryByText('Sensores sin datos')).not.toBeInTheDocument();
  });

  it('acota un puntaje inválido del backend', async () => {
    server.use(
      http.get('*/api/v1/dashboard/general', () =>
        HttpResponse.json({
          health_score: -20,
          alerts_summary: { CRITICAL: 5, WARNING: 0, INFO: 0, total: 5 },
          sensors: { total: 1, online: 1, offline: 0 },
          generated_at: new Date().toISOString(),
        }),
      ),
    );
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('0')).toBeInTheDocument();
    expect(region.getByText('Atención prioritaria')).toBeInTheDocument();
  });

  it('marca el puntaje como desactualizado si generated_at es antiguo', async () => {
    server.use(
      http.get('*/api/v1/dashboard/general', () =>
        HttpResponse.json({
          health_score: 100,
          alerts_summary: { CRITICAL: 0, WARNING: 0, INFO: 0, total: 0 },
          sensors: { total: 1, online: 1, offline: 0 },
          generated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
        }),
      ),
    );
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const region = await scoreRegion();
    expect(await region.findByText('Dato desactualizado')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm --filter @gd/web test`
Expected: FAIL — módulos de `features/home` no encontrados.

- [ ] **Step 3: Implementar**

`apps/web/src/features/home/healthCopy.ts`:
```ts
import type { HealthBand, ScoreDeduction, StatusLevel } from '@gd/domain';

export const BAND_LABEL: Record<HealthBand, string> = {
  GOOD: 'Buen estado',
  ATTENTION: 'Requiere atención',
  PRIORITY: 'Atención prioritaria',
};

export const BAND_TONE: Record<HealthBand, StatusLevel> = {
  GOOD: 'OK',
  ATTENTION: 'WARNING',
  PRIORITY: 'CRITICAL',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function deductionText(deduction: ScoreDeduction): string {
  const { count } = deduction;
  switch (deduction.reason) {
    case 'CRITICAL':
      return plural(count, 'alerta crítica', 'alertas críticas');
    case 'WARNING':
      return plural(count, 'advertencia', 'advertencias');
    case 'INFO':
      return plural(count, 'alerta informativa', 'alertas informativas');
    case 'OFFLINE':
      return plural(count, 'sensor sin datos', 'sensores sin datos');
  }
}
```

`apps/web/src/features/home/Home.module.css`:
```css
.page { display: grid; gap: var(--space-6); }
.page h1 { margin: 0; }
.grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-6);
}
.card h2 { margin: 0 0 var(--space-4); font-size: 1.125rem; }
.scoreRow { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }
.score { margin: 0; font-size: 3.5rem; font-weight: 800; line-height: 1; }
.scoreMax { font-size: 1.25rem; color: var(--text-muted); font-weight: 600; }
.band {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  font-weight: 700;
}
.band[data-tone='OK'] { color: var(--status-ok-fg); background: var(--status-ok-bg); }
.band[data-tone='WARNING'] { color: var(--status-warning-fg); background: var(--status-warning-bg); }
.band[data-tone='CRITICAL'] { color: var(--status-critical-fg); background: var(--status-critical-bg); }
.deductions { margin: var(--space-4) 0 0; padding-left: var(--space-6); }
.note { margin: var(--space-3) 0 0; color: var(--text-muted); font-size: 0.875rem; }
.staleTag {
  display: inline-block;
  margin-top: var(--space-3);
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--status-warning-bg);
  color: var(--status-warning-fg);
  font-weight: 600;
}
.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius);
  background: var(--status-critical-bg);
  color: var(--status-critical-fg);
  border-left: 6px solid var(--status-critical-fg);
}
.banner h2 { margin: 0; font-size: 1.125rem; display: flex; align-items: center; gap: var(--space-2); }
.banner p { margin: var(--space-1) 0 0; }
.bannerLink {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-4);
  border-radius: var(--radius);
  background: var(--status-critical-fg);
  color: var(--surface);
  font-weight: 700;
  text-decoration: none;
}
.links { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.linkCard {
  display: block;
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  text-decoration: none;
}
.linkCard strong { display: block; }
.linkCard span { color: var(--text-muted); font-size: 0.875rem; }
.disclaimer { color: var(--text-muted); font-size: 0.875rem; margin: 0; }
```

`apps/web/src/features/home/HealthScoreCard.tsx`:
```tsx
import type { DashboardGeneral } from '@gd/api';
import { clampScore, healthBand, isStale, scoreBreakdown } from '@gd/domain';
import { POLL_INTERVALS_MS } from '@gd/query';
import { STATUS_META } from '../../ui/statusMeta';
import styles from './Home.module.css';
import { BAND_LABEL, BAND_TONE, deductionText } from './healthCopy';

export function HealthScoreCard({ data, now }: { data: DashboardGeneral; now: Date }) {
  const score = clampScore(data.health_score);
  const band = healthBand(score);
  const tone = BAND_TONE[band];
  const { Icon } = STATUS_META[tone];
  const deductions = scoreBreakdown({
    critical: data.alerts_summary.CRITICAL,
    warning: data.alerts_summary.WARNING,
    info: data.alerts_summary.INFO,
    offlineSensors: data.sensors.offline,
  });
  const stale = isStale(data.generated_at, now, POLL_INTERVALS_MS.dashboardGeneral * 2);

  return (
    <>
      <div className={styles.scoreRow}>
        <p className={styles.score}>
          <span>{score}</span>
          <span className={styles.scoreMax}>/100</span>
        </p>
        <span className={styles.band} data-tone={tone}>
          <Icon aria-hidden="true" size={18} />
          {BAND_LABEL[band]}
        </span>
      </div>
      {deductions.length > 0 ? (
        <ul className={styles.deductions} aria-label="Qué resta puntos">
          {deductions.map((d) => (
            <li key={d.reason}>{`−${d.points} · ${deductionText(d)}`}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>Sin alertas abiertas ni sensores sin datos.</p>
      )}
      <p className={styles.note}>Puntaje calculado a partir de las alertas abiertas y los sensores sin datos.</p>
      {stale && <span className={styles.staleTag}>Dato desactualizado</span>}
    </>
  );
}
```

`apps/web/src/features/home/CriticalBanner.tsx`:
```tsx
import type { Role } from '@gd/api';
import { useAlerts } from '@gd/query';
import { OctagonX } from 'lucide-react';
import { Link } from 'react-router';
import styles from './Home.module.css';

export function CriticalBanner({ role }: { role: Role }) {
  const { data } = useAlerts(role, { level: 'CRITICAL', acknowledged: false });
  const alerts = data?.data ?? [];
  if (alerts.length === 0) return null;

  const single = alerts.length === 1 ? alerts[0] : undefined;
  const href = single ? `/alertas?alerta=${encodeURIComponent(single.alert_id)}` : '/alertas?nivel=CRITICAL&acusada=false';
  const title = single ? '1 alerta crítica sin revisar' : `${alerts.length} alertas críticas sin revisar`;

  return (
    <section className={styles.banner} aria-label="Alertas críticas sin revisar">
      <div>
        <h2>
          <OctagonX aria-hidden="true" size={22} />
          {title}
        </h2>
        <p>{alerts[0]?.message}</p>
      </div>
      <Link className={styles.bannerLink} to={href}>
        {single ? 'Ver alerta' : 'Ver alertas'}
      </Link>
    </section>
  );
}
```

`apps/web/src/features/home/AlertKpis.tsx`:
```tsx
import type { DashboardGeneral } from '@gd/api';
import { KpiCard } from '../../ui/KpiCard';
import styles from './Home.module.css';

export function AlertKpis({ data }: { data: DashboardGeneral }) {
  const { CRITICAL, WARNING, INFO } = data.alerts_summary;
  return (
    <div className={styles.grid}>
      <KpiCard label="Alertas críticas" value={CRITICAL} tone={CRITICAL > 0 ? 'CRITICAL' : 'OK'} />
      <KpiCard label="Advertencias" value={WARNING} tone={WARNING > 0 ? 'WARNING' : 'OK'} />
      <KpiCard label="Informativas" value={INFO} tone={INFO > 0 ? 'INFO' : 'OK'} />
    </div>
  );
}
```

`apps/web/src/features/home/SensorKpis.tsx`:
```tsx
import type { DashboardGeneral } from '@gd/api';
import { KpiCard } from '../../ui/KpiCard';
import styles from './Home.module.css';

export function SensorKpis({ data }: { data: DashboardGeneral }) {
  const { total, online, offline } = data.sensors;
  return (
    <div className={styles.grid}>
      <KpiCard label="Sensores en línea" value={`${online} de ${total}`} tone="OK" />
      <KpiCard
        label="Sensores sin datos"
        value={offline}
        tone={offline > 0 ? 'OFFLINE' : 'OK'}
        hint="Sin reporte en los últimos 15 minutos"
      />
    </div>
  );
}
```

`apps/web/src/features/home/CategoryLinks.tsx`:
```tsx
import type { Role } from '@gd/api';
import { Link } from 'react-router';
import styles from './Home.module.css';

const LINKS: { to: string; title: string; text: string; roles: Role[] }[] = [
  { to: '/estructural', title: 'Estructural', text: 'Vibraciones, inclinación y fisuras', roles: ['ADMIN'] },
  { to: '/consumos', title: 'Consumos', text: 'Agua y energía de zonas comunes', roles: ['ADMIN'] },
  { to: '/aire', title: 'Calidad del aire', text: 'CO₂ en zonas comunes', roles: ['ADMIN', 'RESIDENTE'] },
  { to: '/mantenimiento', title: 'Mantenimiento', text: 'Tareas pendientes y evidencias', roles: ['ADMIN'] },
  { to: '/gemelo', title: 'Gemelo 3D', text: 'Estado de los sensores en el modelo', roles: ['ADMIN'] },
  { to: '/alertas', title: 'Alertas', text: 'Historial de avisos del edificio', roles: ['RESIDENTE'] },
];

export function CategoryLinks({ role }: { role: Role }) {
  return (
    <nav className={styles.links} aria-label="Ir a una sección">
      {LINKS.filter((link) => link.roles.includes(role)).map((link) => (
        <Link key={link.to} to={link.to} className={styles.linkCard}>
          <strong>{link.title}</strong>
          <span>{link.text}</span>
        </Link>
      ))}
    </nav>
  );
}
```

`apps/web/src/features/home/HomePage.tsx`:
```tsx
import { POLL_INTERVALS_MS, useDashboardGeneral } from '@gd/query';
import { useSession } from '../../app/session/SessionProvider';
import { DataState } from '../../ui/DataState';
import { useNow } from '../../ui/useNow';
import { AlertKpis } from './AlertKpis';
import { CategoryLinks } from './CategoryLinks';
import { CriticalBanner } from './CriticalBanner';
import { HealthScoreCard } from './HealthScoreCard';
import styles from './Home.module.css';
import { SensorKpis } from './SensorKpis';

export function HomePage() {
  const { session } = useSession();
  const general = useDashboardGeneral();
  const now = useNow();
  if (!session) return null;
  const role = session.claims.role;
  const isAdmin = role === 'ADMIN';

  return (
    <div className={styles.page}>
      <h1>Estado general</h1>
      <CriticalBanner role={role} />

      <section className={styles.card} aria-labelledby="health-title">
        <h2 id="health-title">Salud del edificio</h2>
        <DataState label="salud del edificio" query={general} staleAfterMs={POLL_INTERVALS_MS.dashboardGeneral * 2}>
          {(data) => <HealthScoreCard data={data} now={now} />}
        </DataState>
      </section>

      {general.data && (
        <section aria-label="Resumen de alertas y sensores">
          <AlertKpis data={general.data} />
          {isAdmin && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <SensorKpis data={general.data} />
            </div>
          )}
        </section>
      )}

      <CategoryLinks role={role} />

      <p className={styles.disclaimer}>
        El sistema detecta y avisa cambios medibles en las zonas comunes. No reemplaza la inspección de un profesional.
      </p>
    </div>
  );
}
```

En `apps/web/src/app/routes.tsx`, cambiar `<Route index element={<PendingSection title="Estado general" />} />` por `<Route index element={<HomePage />} />` e importar `HomePage` desde `../features/home/HomePage`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm --filter @gd/web test; pnpm --filter @gd/web typecheck; pnpm lint`
Expected: PASS (incluidos los tests de rutas de Task 12; el test "el administrador ve todas las secciones" sigue pasando porque usa `/sensores`).

- [ ] **Step 5: Verificación manual**

Run: `pnpm dev`, abrir `http://localhost:5173/?escenario=critico` y entrar como admin.
Expected: banner rojo "1 alerta crítica sin revisar" con "Ver alerta"; puntaje 56 "Requiere atención" con desglose; KPIs; enlaces por categoría. Repetir con `?escenario=vacio` (100, "Buen estado", "Sin alertas abiertas…"). Detener el servidor.

- [ ] **Step 6: Commit**

```
git add apps/web
git commit -m "feat(web): home Estado general con puntaje, desglose y banner de críticas"
```

---

### Task 14: Pruebas E2E con Playwright y accesibilidad con axe

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/helpers.ts`, `apps/web/e2e/auth.spec.ts`, `apps/web/e2e/home.spec.ts`, `apps/web/e2e/a11y.spec.ts`

**Interfaces:**
- Consumes: app completa en modo mock (`pnpm dev`), `window.__gdMocks` (Task 10), credenciales demo (Task 10).
- Produces: suite `pnpm e2e` con proyectos `tablet` (820×1180) y `escritorio` (1440×900).

- [ ] **Step 1: Instalar el navegador**

Run: `pnpm --filter @gd/web exec playwright install chromium`
Expected: Chromium descargado.

- [ ] **Step 2: Configurar Playwright**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 } } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

`apps/web/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test';

export const ADMIN = 'admin@demo.co';
export const RESIDENTE = 'residente@demo.co';
export const PASSWORD = 'Demo1234!';

export async function login(page: Page, email: string, password = PASSWORD, path = '/login') {
  await page.goto(path);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

export async function expectHome(page: Page) {
  await expect(page.getByRole('heading', { name: 'Estado general', level: 1 })).toBeVisible();
}
```

- [ ] **Step 3: Escribir los specs**

`apps/web/e2e/auth.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { ADMIN, RESIDENTE, expectHome, login } from './helpers';

test('el administrador entra, recarga y sigue con sesión', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await page.reload();
  await expectHome(page);
});

test('una ruta protegida sin sesión vuelve a ella tras el login', async ({ page }) => {
  await page.goto('/aire');
  await expect(page).toHaveURL(/\/login\?volver=%2Faire/);
  await page.getByLabel('Correo electrónico').fill(ADMIN);
  await page.getByLabel('Contraseña').fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Calidad del aire' })).toBeVisible();
});

test('el residente no ve secciones de administración y recibe "sin permiso"', async ({ page }) => {
  await login(page, RESIDENTE);
  await expectHome(page);
  const nav = page.getByRole('navigation', { name: 'Secciones' });
  await expect(nav.getByRole('link', { name: 'Calidad del aire' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Sensores' })).toHaveCount(0);
  await page.goto('/sensores');
  await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();
});

test('bloqueo de cuenta tras 5 intentos fallidos', async ({ page }) => {
  await page.goto('/login');
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Correo electrónico').fill(ADMIN);
    await page.getByLabel('Contraseña').fill('incorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await expect(page.getByRole('alert')).toContainText('bloqueada temporalmente');
});

test('cerrar sesión vuelve al login y no restaura la sesión al recargar', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('si la sesión expira aparece el modal y se recupera sin perder la pantalla', async ({ page }) => {
  await page.clock.install();
  await login(page, ADMIN);
  await expectHome(page);
  await page.evaluate(() => {
    window.__gdMocks?.expireAccessTokens();
    window.__gdMocks?.revokeRefreshTokens();
  });
  await page.clock.fastForward('00:31');
  const dialog = page.getByRole('dialog', { name: 'Tu sesión expiró' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Contraseña').fill('Demo1234!');
  await dialog.getByRole('button', { name: 'Ingresar' }).click();
  await expect(dialog).toBeHidden();
  await expectHome(page);
});
```

`apps/web/e2e/home.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login } from './helpers';

test('escenario crítico: banner, puntaje y enlace a la alerta en 1 clic', async ({ page }) => {
  await login(page, ADMIN, 'Demo1234!', '/login?escenario=critico');
  await expectHome(page);
  const banner = page.getByRole('region', { name: 'Alertas críticas sin revisar' });
  await expect(banner).toContainText('1 alerta crítica sin revisar');
  const health = page.getByRole('region', { name: 'Salud del edificio' });
  await expect(health).toContainText('56');
  await expect(health).toContainText('Requiere atención');
  await banner.getByRole('link', { name: 'Ver alerta' }).click();
  await expect(page).toHaveURL(/\/alertas\?alerta=alrt-\d{8}-00004$/);
});

test('escenario vacío: edificio sin alertas', async ({ page }) => {
  await login(page, ADMIN, 'Demo1234!', '/login?escenario=vacio');
  const health = page.getByRole('region', { name: 'Salud del edificio' });
  await expect(health).toContainText('100');
  await expect(health).toContainText('Sin alertas abiertas ni sensores sin datos.');
});
```

`apps/web/e2e/a11y.spec.ts`:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('login sin violaciones WCAG AA', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('home en escenario crítico sin violaciones WCAG AA', async ({ page }) => {
  await login(page, ADMIN, 'Demo1234!', '/login?escenario=critico');
  await expectHome(page);
  await expect(page.getByRole('region', { name: 'Salud del edificio' })).toContainText('56');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 4: Correr la suite E2E**

Run: `pnpm e2e`
Expected: todas las pruebas PASS en `tablet` y `escritorio`. Si axe reporta contraste, corregir el token de color en `tokens.css` (no desactivar la regla) y volver a correr.

- [ ] **Step 5: Correr la verificación completa**

Run: `pnpm lint; pnpm typecheck; pnpm test; pnpm e2e`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```
git add apps/web
git commit -m "test(web): E2E de sesión, roles, home y accesibilidad"
```

---

## Cobertura del spec en este plan

| Spec | Cubierto en | Pendiente para |
|---|---|---|
| §3 Experiencia por rol | Tasks 4, 7, 12, 13 | — |
| §4 Stack | Tasks 1, 4, 8, 9, 10, 14 | ECharts (Plan 3), @thatopen (Plan 4), Zustand si hace falta |
| §5 Arquitectura / reglas de dependencia / modelo de estado por sensor | Tasks 1, 4–8 | `@gd/realtime` (Plan 2) |
| §6 Mapa de pantallas, shell, home | Tasks 12, 13 | Secciones (Planes 2–5); densidad por zona y tarjetas con datos (Plan 3) |
| §7 Sesión y seguridad | Tasks 5, 6, 11, 12 | CSP (Plan 5) |
| §8 Tiempo real y DataState | Tasks 8, 9 (polling, DataState) | Socket, toasts, banner sin conexión (Plan 2) |
| §9 Lenguaje de estados y localización | Tasks 3, 9 | Series y gráficas (Plan 3) |
| §11 Responsive y accesibilidad | Tasks 9, 12, 14 | Revisión por sección en cada plan |
| §12 Mocks y testing | Tasks 10, 14 | Series, ack, mantenimiento y PDF en mocks (Planes 2–5); `contract.spec` y CI (Plan 5) |

## Notas de ejecución (2026-10-02)

- R4 (ocultar al residente el conteo de sensores sin datos en el home) es una decisión de UX, no un control de privacidad: el residente puede derivar la cantidad de sensores caídos de forma aritmética. La garantía real es por endpoint: qué datos entrega cada uno al rol residente.
- R5: el modo `lenient` de `@gd/api` ya no devuelve datos crudos; una respuesta que no pasa el esquema se reporta con `onContractDrift` y además lanza `ContractDriftError`, de modo que la sección se degrada a "formato inesperado" y los esquemas por rol (que quitan campos al residente) nunca se esquivan.
- Supuestos del mock sin confirmar con backend: el 423 de cuenta bloqueada y el 429 con `Retry-After` en el login. Verificarlos contra el backend real.
- Se conserva el `AGENTS.md` que generó la plantilla de turbo.
- El lockfile contiene dos mayores de vite: `apps/web` usa vite 7 y vitest arrastra vite 8.
- Plan 5, `contract.spec`: verificar los envoltorios `{count, data}` de las listas, los campos anulables del ack y la forma de la respuesta de `/auth/refresh`.
