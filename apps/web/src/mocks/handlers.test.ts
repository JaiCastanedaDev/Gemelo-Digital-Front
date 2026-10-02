import {
  ApiError,
  MemoryTokenStore,
  createApi,
  createHttpClient,
  createSessionManager,
} from '@gd/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('backend simulado: estabilidad con el paso del tiempo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function loginAdmin() {
    const { session, api } = client();
    const s = await session.login(ADMIN_EMAIL, DEMO_PASSWORD);
    return { api, token: s.accessToken };
  }

  function advance30Minutes() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 30 * 60_000);
  }

  it('sano sigue con health_score 96 y 0 sensores sin datos 30 min después', async () => {
    resetDb('sano');
    const { api } = await loginAdmin();
    advance30Minutes();
    const general = await api.dashboard.general();
    expect(general.health_score).toBe(96);
    expect(general.sensors.offline).toBe(0);
  });

  it('caido sigue con health_score 66 y 6 sensores sin datos 30 min después', async () => {
    resetDb('caido');
    const { api } = await loginAdmin();
    advance30Minutes();
    const general = await api.dashboard.general();
    expect(general.health_score).toBe(66);
    expect(general.sensors.offline).toBe(6);
  });

  it.each([
    ['sano', 0],
    ['caido', 6],
  ] as const)('GET /sensors (%s) recalcula last_seen_at al leer: %i sin datos', async (scenario, expectedOffline) => {
    resetDb(scenario);
    advance30Minutes();
    const { token } = await loginAdmin();
    const now = Date.now();
    const { data } = (await rawGet('/sensors', token)) as { data: { last_seen_at: string }[] };
    const ageMin = (s: { last_seen_at: string }) => (now - Date.parse(s.last_seen_at)) / 60_000;
    expect(data.filter((s) => ageMin(s) > 15)).toHaveLength(expectedOffline);
    expect(data.filter((s) => ageMin(s) <= 2)).toHaveLength(data.length - expectedOffline);
  });
});
