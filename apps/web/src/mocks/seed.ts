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
