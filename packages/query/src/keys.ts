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
