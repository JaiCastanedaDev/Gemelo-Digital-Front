# Gemelo Digital 3D — Diseño del Frontend (MVP)

- **Fecha:** 2026-10-02
- **Estado:** aprobado en brainstorming, pendiente de revisión del spec escrito
- **Alcance:** frontend web (escritorio/tablet) para ADMIN y RESIDENTE; base reutilizable para la futura app móvil.

---

## 1. Contexto y objetivos

Gemelo Digital 3D convierte datos de sensores de un conjunto residencial (propiedad horizontal) en información comprensible para administradores no técnicos. El backend existe y su contrato es fijo (REST `/api/v1`, JSON snake_case, JWT, Socket.IO).

**Criterios de éxito del MVP**

1. El administrador entiende el estado del edificio de un vistazo desde el home.
2. Una alerta crítica está a ≤2 clics desde cualquier pantalla (1 desde el banner del home o desde el toast).
3. Una alerta CRITICAL/WARNING aparece en pantalla en <2 s desde que el backend la emite.
4. Un sensor sin reporte >15 min nunca se ve como sano.
5. El administrador puede: monitorear, atender (acusar) alertas, cerrar mantenimientos con evidencia, descargar el reporte estructural y ver el gemelo 3D coloreado por estado.

**Principios no negociables**

- **Privacidad:** solo zonas comunes; nunca consumo ni datos por apartamento/unidad privada.
- **Honestidad del copy:** el sistema *detecta y avisa cambios medibles*; no diagnostica ni predice. Prohibido "diagnóstico", "predicción", "riesgo de colapso" en la UI.
- **El residente no ve valores numéricos** (ni ppm, ni value_triggered, ni threshold).
- **Ocultar ≠ autorizar:** la UI filtra por rol por UX; el backend es la autoridad.

**Supuestos**

- 1 desarrollador de front; Fase 2 = 4 semanas.
- Frecuencia de reporte de sensores ≈ 1 lectura/min (no confirmado; ver Riesgos).
- Schemas basados en el resumen del contrato, no en el código del backend (no disponible localmente).
- Modelo IFC de ejemplo hasta tener el del conjunto real.

---

## 2. Alcance

### MVP (corte "demostrable al administrador")

| Semana | Entregables |
|---|---|
| 1 | Monorepo y tooling; auth/sesión; layout y navegación por rol; mocks MSW + seed; `DataState`; home Estado general; centro de alertas (filtros, acuse optimista, occurrence_count, socket + toasts) |
| 2 | Estructural, Consumos, Calidad del aire con series temporales (1h/24h/7d/30d, downsampling) y comparación vs periodo anterior; tabla de sensores + `SensorDetailPanel` |
| 3 | Gemelo 3D: IFC de ejemplo, mapeo JSON, coloreado por estado, aislar piso, filtro por categoría, panel de detalle, deep-link "Ver en 3D" |
| 4 | Mantenimiento (lista, crear, completar con evidencia, ver evidencia protegida); Reportes (PDF con selector de rango); vista residente (home + alertas sin valores); pulido a11y; E2E |

### Fuera del MVP (iteraciones posteriores)

Kanban y calendario de mantenimiento; reporte de consumo mensual (placeholder "Próximamente"); CRUD de umbrales y gestión de sensores (ocultos); usuarios y roles Consejo / Técnico externo; push/correo/SMS; app móvil; caché de fragments 3D en IndexedDB; acuse masivo de alertas.

---

## 3. Usuarios y experiencia por rol

Una sola app con vistas por rol.

- **ADMIN** — monitoreo diario, atender alertas, cerrar mantenimientos, generar reportes, explorar el gemelo 3D. Acceso a todas las secciones.
- **RESIDENTE** — "¿está bien mi edificio?, ¿hay algo que me afecte?". Acceso a: Estado general (sin números de sensores), Alertas (solo lectura, sin valores), Calidad del aire (solo etiqueta BUENO/REGULAR/MALO).

Los tipos de datos son distintos por rol (`AlertAdmin` / `AlertResidente`, `ComfortZoneAdmin` / `ComfortZoneResidente`): las vistas del residente no tienen acceso tipado a campos numéricos.

---

## 4. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | React 19 + Vite + TypeScript (strict) | CORS por defecto apunta a `localhost:5173`; reuso con React Native |
| Monorepo | pnpm workspaces + Turborepo | Paquetes compartidos con la futura app móvil |
| Routing | React Router | SPA con estado en URL |
| Estado servidor | TanStack Query | Caché, polling, invalidación, optimistic updates; funciona en RN |
| Estado cliente | Zustand (sesión, UI) | Mínimo y portable |
| Validación/contrato | Zod | Fuente de verdad de tipos + validación runtime |
| Formularios | react-hook-form + Zod | Mapeo de 422 a campos |
| Gráficas | Apache ECharts (canvas) | Series grandes, `sampling: 'lttb'`, dataZoom |
| 3D/IFC | `@thatopen/components` (web-ifc + Three.js) | Licencia MIT (xeokit es AGPL) |
| Tiempo real | socket.io-client | Contrato del backend; funciona en RN |
| Mocks | MSW | Mismo mock en dev, Vitest y Playwright |
| Tests | Vitest, Testing Library, Playwright, axe-core | |

---

## 5. Arquitectura

### 5.1 Estructura del monorepo

```
gemelo-digital-front/
├─ apps/
│  └─ web/
│     ├─ app/          router, layout, guards por rol, providers
│     ├─ features/     home/ alerts/ structural/ consumption/ comfort/
│     │                sensors/ maintenance/ reports/ twin3d/ auth/
│     ├─ ui/           design system: StatusBadge, KpiCard, DataState, Chart, Drawer…
│     └─ mocks/        MSW handlers + seed (solo dev/test)
└─ packages/
   ├─ api/       @gd/api       cliente HTTP, schemas Zod, tipos por rol, errores, TokenStore (interfaz)
   ├─ domain/    @gd/domain    reglas puras: estado de sensor, obsolescencia, score, niveles,
   │                           downsampling (LTTB, min/max), formato es-CO / America/Bogota
   ├─ realtime/  @gd/realtime  cliente Socket.IO con reconexión por token
   ├─ query/     @gd/query     hooks TanStack Query, query keys, intervalos de polling
   └─ config/                  tsconfig, eslint, prettier
```

### 5.2 Reglas de dependencia

- `domain` no depende de nada.
- `api` → `domain` (solo tipos/constantes si hace falta).
- `realtime` → `api` (tipos).
- `query` → `api`, `domain`, `realtime`.
- `apps/web` → todo.
- **Ningún paquete usa APIs del navegador** (`window`, `document`, `localStorage`). Almacenamiento (`TokenStore`), reloj (`Clock`), logger y navegación se inyectan. ECharts y el visor IFC viven solo en `apps/web`.
- Se hace cumplir con `eslint-plugin-boundaries`.

### 5.3 Modelo central: estado por sensor

`@gd/domain` expone:

```ts
buildSensorStatusMap(sensors, alerts, now): Map<SensorId, SensorStatus>
// SensorStatus = { level: 'CRITICAL'|'WARNING'|'INFO'|'OK'|'OFFLINE', lastSeenAt, zone, category }
```

Reglas: OFFLINE si `now − last_seen_at > 15 min` (prevalece sobre cualquier otro estado); si no, el nivel más severo entre las alertas no acusadas del sensor; si no hay, OK.

Consumidores: home, dashboards, tabla de sensores, `SensorDetailPanel` y visor 3D. El 3D es un consumidor más, no una arquitectura aparte.

### 5.4 Ruteo y estado en URL

Filtros, rangos y selección viven en la URL (`/alertas?nivel=CRITICAL&acusada=false`, `/gemelo?sensor=xyz`, `/sensores?sensor=xyz&rango=24h`) para permitir deep-links, compartir y replicar en móvil.

---

## 6. Mapa de pantallas

**Shell:** cabecera (nombre del conjunto, indicador "En vivo / Sin conexión · datos de hace X", campana con contador de no acusadas —rojo si hay CRITICAL—, menú de usuario) + menú lateral (iconos en tablet, barra inferior en móvil).

| Ruta | Pantalla | ADMIN | RESIDENTE |
|---|---|---|---|
| `/login` | Inicio de sesión | ✓ | ✓ |
| `/` | Estado general | ✓ | ✓ (sin números de sensores) |
| `/alertas` | Centro de alertas | ✓ | ✓ (lectura, sin valores) |
| `/estructural` | Salud estructural | ✓ | — |
| `/consumos` | Consumos | ✓ | — |
| `/aire` | Calidad del aire | ✓ | ✓ (solo etiqueta) |
| `/gemelo` | Gemelo 3D | ✓ | — |
| `/sensores` | Sensores | ✓ | — |
| `/mantenimiento` | Mantenimiento | ✓ | — |
| `/reportes` | Reportes | ✓ | — |

**Funciones sin backend:** se ocultan (umbrales, gestión de sensores, usuarios/Consejo). Excepción: "Consumo mensual" en Reportes como tarjeta deshabilitada "Próximamente".

### 6.1 Estado general (`/`)

- Semáforo de salud 0-100 con bandas configurables (propuesta: ≥80 "Buen estado", 50-79 "Requiere atención", <50 "Atención prioritaria"; a validar con negocio).
- Desglose de lo que resta puntos ("−25 · 1 alerta crítica", "−10 · 2 sensores sin datos"), calculado en `@gd/domain` con la fórmula del backend: `100 − (25·crít + 10·adv + 2·info + 5·offline)`.
- Banner rojo de críticas sin acusar (clic → alerta).
- KPIs: alertas por nivel; sensores online/offline.
- Tarjetas por categoría (Estructural, Consumos, Aire, Mantenimiento) con "Actualizado hace X" y enlace a la sección.
- ADMIN: densidad de sensores por zona y estado (barras apiladas).

### 6.2 Estructural, Consumos, Aire

- **Estructural:** `structural_score`, lista de sensores en alerta, series (aceleración X/Y/Z, inclinación, fisuras).
- **Consumos:** por unidad de medida; barras actual vs anterior; "↑ 12 % vs mismo tramo del mes anterior"; `variation_pct: null` → "Sin datos del periodo anterior" (nunca 0 %). Sin datos por apartamento.
- **Aire:** zonas con BUENO/REGULAR/MALO; ADMIN ve ppm y serie de CO₂. El front no hardcodea umbrales de CO₂: usa la etiqueta del backend.

### 6.3 Sensores y `SensorDetailPanel`

Tabla filtrable (estado, categoría, zona, batería, firmware, última vez visto). El panel lateral compartido (desde tabla, alerta o 3D) muestra nombre, zona, estado (OFFLINE → "Sin datos desde HH:mm"), batería, serie con rangos, alertas del sensor y "Ver en 3D".

---

## 7. Sesión y seguridad en cliente

### 7.1 Tokens

- **Access token:** solo en memoria.
- **Refresh token + objeto `user` (no sensible):** `sessionStorage`, detrás de la interfaz `TokenStore` (móvil: `expo-secure-store`).
- Sin `/me`: al recargar se llama `/auth/refresh`; rol y `buildingId` se decodifican del JWT; nombre/email del `user` guardado.

### 7.2 Flujos

- **Bootstrap:** si hay refresh token → refresh antes de renderizar (splash). Si falla → `/login?volver=<ruta>`.
- **Login:** errores diferenciados: credenciales (mensaje genérico), cuenta bloqueada ("intenta en 15 min"), 429 (cuenta regresiva).
- **Refresh silencioso:** programado a `expires_in − 120 s` medido desde la recepción (no desde el claim `exp`). **Single-flight:** una promesa de refresh compartida; ante 401, se espera el refresh y se reintenta la petición **una sola vez**. Si el refresh falla → cierre de sesión local.
- **Expiración en un formulario:** modal de re-login sobre la pantalla actual; el formulario conserva su estado y la petición pendiente se reintenta. Si inicia sesión un usuario distinto → limpiar todo e ir al home.
- **Logout:** `POST /auth/logout` (best-effort) → limpiar `TokenStore` → desconectar socket → `queryClient.clear()` → `/login`.

### 7.3 Mapeo de errores

| Respuesta | UI |
|---|---|
| 401 | Flujo de refresh; si falla, re-login |
| 403 | Pantalla "No tienes permiso para esta sección" |
| 404 | Estado vacío "No encontrado" |
| 422 `VALIDATION_ERROR` | `details[].path` → error en el campo |
| 413 `UPLOAD_*` | "El archivo supera 5 MB" (o mensaje según code) |
| 429 | Aviso con tiempo de espera |
| 5xx / red | Estado de error con "Reintentar" |

### 7.4 Endurecimiento

CSP estricta; prohibido `dangerouslySetInnerHTML`; sin tokens en URLs ni logs.

---

## 8. Tiempo real y frescura de datos

### 8.1 Modelo híbrido

**Socket (`@gd/realtime`)**

- Conecta solo con sesión válida (`auth: { token }`).
- Al rotar el token: `socket.auth.token = nuevo` + `disconnect()` / `connect()`.
- `connect_error` por auth → dispara refresh → reconecta con backoff exponencial.
- Al reconectar: invalida `alerts` y `dashboard/general` (recupera eventos perdidos).
- `alert:new`:
  - Deduplica por `alert_id` (si existe, actualiza `occurrence_count`).
  - Inserta en caché; invalida `general`, `structural` y el estado de sensores (incluye 3D).
  - CRITICAL → toast persistente + sonido + `aria-live="assertive"`.
  - WARNING → toast 8 s, sin sonido, `aria-live="polite"`.
  - Si el navegador bloquea el audio, la campana muestra "activar sonido".
- Pestaña oculta: el título cambia a "(1) ⚠ Alerta crítica".

**Polling** (configuración centralizada en `@gd/query`; se pausa con pestaña oculta y refetch al volver)

| Recurso | Intervalo |
|---|---|
| `dashboard/general`, `dashboard/comfort` | 30 s |
| `sensors`, `dashboard/structural`, `alerts` (recoge INFO) | 60 s |
| `dashboard/consumption` | 5 min |

El objetivo <2 s aplica a alertas CRITICAL/WARNING; el resto llega con el retraso del ciclo de polling y lo indica con "Actualizado hace X".

### 8.2 Estados de datos — componente `DataState`

`cargando` (skeleton) · `vacío` (mensaje por sección) · `error` (Reintentar) · `desactualizado` (edad > 2× intervalo) · `sin conexión` (banner global si cae red o socket: "Sin conexión · mostrando datos de hace X min") · `ok` ("Actualizado hace X").

---

## 9. Visualización

### 9.1 Lenguaje de estados (color + icono + texto, siempre)

| Estado | Color | Icono | Texto |
|---|---|---|---|
| CRITICAL | rojo | octágono ✖ | Crítico |
| WARNING | ámbar | triángulo ▲ | Advertencia |
| INFO | azul | círculo *i* | Informativo |
| OK | verde | check ✔ | Normal |
| OFFLINE | gris + rayado | ⊘ | Sin datos desde HH:mm |

Tokens de color validados para AA en claro y oscuro, y con simulación de daltonismo. En 3D, OFFLINE = gris semitransparente.

### 9.2 Series temporales

- Rangos 1h/24h/7d/30d + zoom por arrastre (ECharts dataZoom).
- **Obtención:** `SeriesSource` pide el rango en tramos diarios cacheados por TanStack Query (cambiar de rango o hacer zoom no re-descarga). Hoy: datos crudos; mañana: endpoint agregado, sin tocar las gráficas.
- **Downsampling** en Web Worker (`@gd/domain`) a ~1.500 puntos por serie: **min/max por bucket** para aceleraciones (preserva picos); **LTTB** para inclinación, caudal, kW, CO₂, fisuras.
- **Tope de seguridad:** si el rango supera N lecturas (configurable; inicial 200.000), se ofrece el rango menor con aviso.
- Aceleración X/Y/Z como 3 líneas conmutables.
- Alertas del sensor como marcas en la serie. Sin líneas de umbral (el backend no los expone).
- **Fisuras:** línea + "cambio medido en el periodo: +0,3 mm". Sin proyecciones.
- Cada gráfica tiene "Ver como tabla".

### 9.3 Localización

- `Intl` con `es-CO` y `timeZone: 'America/Bogota'` (`1.234,5 kWh`, `2 oct 2026, 3:45 p. m.`, "hace 5 min").
- Los rangos se eligen en hora de Bogotá y se convierten a ISO-8601 UTC para la API (Bogotá = UTC−5, sin horario de verano).
- Textos en catálogo `es-CO` desde el inicio.

---

## 10. Flujos clave

### 10.1 Centro de alertas

- Filtros: `level` y `acknowledged` vía API; categoría, sensor y fechas en cliente. Todo en la URL.
- Orden: no acusadas primero → severidad → fecha desc.
- Fila: icono de nivel, mensaje, zona/sensor, tiempo relativo, "×N ocurrencias" si `occurrence_count > 1`.
- Detalle (drawer): ADMIN ve valor medido vs umbral configurado, primera/última vez, acusada por/cuándo. Enlaces "Ver sensor" y "Ver en 3D". Acción "Crear tarea de mantenimiento" con descripción precargada.
- **Acuse:** botón "Marcar como revisada" → diálogo de confirmación con "Esto no resuelve la condición; si persiste, se volverá a registrar" → actualización optimista → rollback + toast si falla. Sin acuse masivo en el MVP.

### 10.2 Mantenimiento

- Lista con pestañas Pendientes / En progreso / Completadas; insignia "Vencida" si `due_date` pasó y no está DONE.
- Crear (modal): descripción ≥3 caracteres, `due_date` opcional (Bogotá); 422 → campos.
- **Limitación del contrato:** no existe transición a `IN_PROGRESS`. El MVP solo hace PENDING → DONE; la pestaña "En progreso" muestra lo que venga del backend.
- Completar (modal): un archivo de evidencia (imagen o PDF; confirmar tipos aceptados con el backend), validación cliente ≤5 MB antes de subir, vista previa, barra de progreso real (XHR en `@gd/api` solo para esta llamada), manejo de 413/`UPLOAD_*`.
- **Evidencia protegida (`ProtectedFile`):** `fetch` con Bearer → blob → `URL.createObjectURL` → `revokeObjectURL` al desmontar. Imágenes en visor dentro de la app; PDF en pestaña nueva + descarga. 401 → refresh y reintento.

### 10.3 Reportes

- Presets 7/30/90 días o rango personalizado (por defecto 30 días); validación desde < hasta ≤ hoy.
- "Generar PDF": `fetch` con Bearer → blob → descarga `salud-estructural_YYYY-MM-DD_YYYY-MM-DD.pdf`; carga indeterminada y botón deshabilitado durante la petición.
- Tarjeta "Consumo mensual — Próximamente" deshabilitada.

### 10.4 Gemelo 3D

- **Carga:** ruta lazy → descarga del IFC de ejemplo (progreso) → web-ifc WASM en Worker → fragments de @thatopen. `dispose()` al salir de la ruta.
- **Abstracciones:**
  - `ModelSource`: hoy asset estático; mañana endpoint.
  - `SensorElementMapping`: hoy `twin-mapping.json` versionado; mañana API.
  - `Twin3DViewer`: recibe el mapa de estados y colorea.
- **Formato del mapeo:**
  ```json
  { "model_version": "sample-1", "mappings": [
      { "sensor_id": "...", "ifc_global_id": "...", "ifc_space": null, "zone": "Lobby" } ] }
  ```
  Un sensor se mapea a un elemento (`ifc_global_id`) o, en su defecto, a un espacio/zona. Los no mapeados se listan en "Sin ubicación en el modelo".
- **Interacción:** órbita/zoom; aislar piso (`IfcBuildingStorey`); filtro por categoría; leyenda de estados; clic en elemento → `SensorDetailPanel`; `/gemelo?sensor=id` enfoca cámara y resalta con pulso.
- El coloreado se recalcula al cambiar el mapa de estados (socket o polling) sin recargar el modelo.
- **Plan B:** sin WebGL o error de carga → "El visor 3D no está disponible en este dispositivo" + enlace a la tabla de sensores.

---

## 11. Responsive y accesibilidad

- **Tablet (≥768 px)** objetivo mínimo; escritorio con rejilla más densa.
- **Móvil:** lectura de home, alertas y aire; 3D y formularios muestran "Disponible en tablet o escritorio".
- **WCAG 2.2 AA:** teclado completo, foco visible, objetivos ≥44 px en tablet, contraste AA, `prefers-reduced-motion`, `aria-live` para alertas, alternativa tabular en gráficas; el 3D tiene equivalente accesible en la tabla de sensores.

---

## 12. Mocks y testing

### 12.1 Fuente de verdad

Schemas Zod escritos a mano en `@gd/api`, con variantes por rol. Tipos con `z.infer`. Los mocks y los tests usan los mismos schemas.

### 12.2 MSW

- Handlers para todos los endpoints del contrato; factories generadas desde los schemas.
- **Seed determinista:** conjunto ficticio de 2 torres con zonas comunes (sótano, lobby, gimnasio, salón social, cubierta, cuarto de bombas), ~30 sensores, 30 días de series a 1 lectura/min con tendencias. Incluye sensores offline, batería baja, alerta con `occurrence_count` alto, `variation_pct: null` y zonas con CO₂ MALO.
- **Respeta el rol:** residente sin `ppm`/valores; 403 en rutas ADMIN.
- **Simula:** bloqueo tras 5 logins fallidos, 429, tokens de vida corta en modo test, 413 en subidas >5 MB, PDF de ejemplo.
- **Socket simulado** con emisor de `alert:new` y panel de desarrollo `?dev=1`.
- **Escenarios:** `?escenario=sano|critico|caido|vacio`.
- **Modos:** `pnpm dev` (mocks), `pnpm dev:api` (backend real, base URL por `.env`).

### 12.3 Pruebas

- **Vitest — `@gd/domain`:** estado de sensor y obsolescencia, score y desglose, LTTB y min/max, formato es-CO, conversión Bogotá↔UTC. Mayor cobertura.
- **Vitest — `@gd/api` y `@gd/realtime`:** refresh single-flight, reintento único en 401, mapeo de errores, reconexión del socket con token nuevo.
- **Testing Library:** `DataState`, `StatusBadge`, formulario con 422, modal de evidencia, `ProtectedFile`.
- **Playwright + MSW** (tablet y escritorio):
  1. Login → refresh → expiración con modal de re-login.
  2. Llega una crítica → se marca revisada en ≤2 clics.
  3. Crear tarea → completar con evidencia.
  4. Descargar el PDF.
  5. 3D → panel de detalle; alerta → "Ver en 3D".
  6. Residente sin números y con 403 en rutas ADMIN.
- **axe-core** dentro de Playwright.
- **Deriva de contrato:** `schema.parse` estricto en dev/E2E; `safeParse` + log en producción (sin romper la UI); suite `contract.spec` contra el backend real cuando haya entorno.
- **CI:** lint, typecheck, Vitest y Playwright en cada PR (Turborepo con caché).

---

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| Rendimiento de web-ifc en tablets o con modelos grandes | 3D en semana 3 con margen; lazy + Worker; IFC de ejemplo ligero; plan B a tabla |
| Frecuencia real de sensores > 1/min | Tope de lecturas por rango; pedido de `intervalo` con prioridad alta |
| Schemas armados con un resumen, no con el código del back | Tests de contrato contra el back real en cuanto esté accesible |
| Mapeo 3D en el front, que puede desincronizarse | `model_version` en el JSON; lista de sensores sin mapear |
| XSS con refresh en `sessionStorage` | CSP estricta; sin `dangerouslySetInnerHTML`; pedido de cookie httpOnly |
| Bandas del semáforo y umbrales de CO₂ sin definir (800/1000 vs 800/1200) | Front usa la etiqueta del back; bandas configurables a validar con negocio |
| 1 persona en 4 semanas | Corte B; kanban y calendario fuera; semana 4 recortable |
| Sin transición a `IN_PROGRESS` en mantenimiento | MVP solo PENDING → DONE; pedido al back |

---

## 14. Pedidos al backend (por prioridad)

1. `intervalo` real en `/sensors/:id/data` (agregación min/max/avg por bucket).
2. `GET /me`.
3. Endpoint para pasar una tarea de mantenimiento a `IN_PROGRESS`.
4. Exponer el modelo IFC y el mapeo sensor→elemento (`ifc_global_id`) por API.
5. Refresh token en cookie httpOnly (`SameSite=Strict`, CORS con credenciales).
6. Especificación OpenAPI publicada.
7. Exponer umbrales por sensor (para dibujarlos en gráficas) y unificar umbrales de CO₂.
8. Eventos de socket `sensor:status` y `alert:updated` (acuse o nueva ocurrencia).
9. `alert_id` opcional en la tarea de mantenimiento.
10. URLs firmadas de corta duración para evidencias (opcional).
11. Reporte `monthly_consumption`.
12. Roles Consejo y Técnico externo.
