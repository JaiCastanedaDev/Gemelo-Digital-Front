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
