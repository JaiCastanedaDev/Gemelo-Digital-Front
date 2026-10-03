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
