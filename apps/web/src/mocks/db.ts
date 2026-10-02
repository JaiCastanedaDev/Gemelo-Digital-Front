import type { AlertAdmin, Sensor } from '@gd/api';
import { isOffline } from '@gd/domain';
import { USERS, createSeed, type MockUser, type Scenario } from './seed';

const MIN = 60_000;
const FRESH_AGE_MS = 1 * MIN;
const OFFLINE_AGE_MS = 40 * MIN;

interface LoginAttempts {
  count: number;
  lockedUntil: number | null;
}

export interface MockDb {
  scenario: Scenario;
  users: MockUser[];
  sensors: Sensor[];
  alerts: AlertAdmin[];
  /** Sensores que el escenario define como sin datos; el resto siempre se ve recién visto. */
  offlineSensorIds: Set<string>;
  usedRefreshTokens: Set<string>;
  loginAttempts: Map<string, LoginAttempts>;
  settings: {
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    /** Tokens emitidos antes de este instante (ms) se rechazan. */
    accessValidAfterMs: number;
    refreshValidAfterMs: number;
    /** El próximo POST /alerts/:id/ack responde 500 (para probar la reversión). */
    failNextAck: boolean;
  };
}

function createDb(scenario: Scenario, now: number): MockDb {
  const seed = createSeed(scenario, now);
  return {
    scenario,
    users: USERS,
    sensors: seed.sensors,
    alerts: seed.alerts,
    offlineSensorIds: new Set(
      seed.sensors.filter((s) => isOffline(s.last_seen_at, new Date(now))).map((s) => s.sensor_id),
    ),
    usedRefreshTokens: new Set(),
    loginAttempts: new Map(),
    settings: {
      accessTtlSeconds: 900,
      refreshTtlSeconds: 7 * 24 * 3600,
      accessValidAfterMs: 0,
      refreshValidAfterMs: 0,
      failNextAck: false,
    },
  };
}

export const db: MockDb = createDb('sano', Date.now());

/**
 * Sensores con `last_seen_at` calculado al leer, para que el escenario no se degrade
 * con el paso del tiempo: los sanos siempre se ven recién vistos y los caídos siguen sin datos.
 */
export function getSensors(now = Date.now()): Sensor[] {
  return db.sensors.map((s) => ({
    ...s,
    last_seen_at: new Date(now - (db.offlineSensorIds.has(s.sensor_id) ? OFFLINE_AGE_MS : FRESH_AGE_MS)).toISOString(),
  }));
}

export function resetDb(scenario: Scenario = 'sano', now = Date.now()): void {
  Object.assign(db, createDb(scenario, now));
}
