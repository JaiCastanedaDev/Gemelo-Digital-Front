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
      // Sinusoide lenta (periodo de 30 días): continua, sin saltos anuales.
      return { width: 0.4 + 0.1 * Math.sin((2 * Math.PI * t) / (30 * DAY)) + n * 0.002 };
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
