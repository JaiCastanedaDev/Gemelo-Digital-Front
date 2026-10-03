import type {
  AlertFilters,
  AlertListResidente,
  ComfortResidente,
  DashboardConsumption,
  DashboardGeneral,
  DashboardStructural,
  Role,
  SensorList,
} from '@gd/api';
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

export function useDashboardStructural(): UseQueryResult<DashboardStructural> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.structural(),
    queryFn: ({ signal }) => api.dashboard.structural(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardStructural,
  });
}

export function useDashboardConsumption(): UseQueryResult<DashboardConsumption> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.consumption(),
    queryFn: ({ signal }) => api.dashboard.consumption(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardConsumption,
  });
}

/** Confort con la forma común (sin `ppm`); el ADMIN recibe además `ppm` en runtime. */
export function useComfort(role: Role): UseQueryResult<ComfortResidente> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.dashboard.comfort(role),
    queryFn: ({ signal }): Promise<ComfortResidente> =>
      role === 'ADMIN' ? api.dashboard.comfortAdmin(signal) : api.dashboard.comfortResidente(signal),
    refetchInterval: POLL_INTERVALS_MS.dashboardComfort,
  });
}

export function useSensors(options: { enabled?: boolean } = {}): UseQueryResult<SensorList> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.sensors.list(),
    queryFn: ({ signal }) => api.sensors.list(signal),
    refetchInterval: POLL_INTERVALS_MS.sensors,
    enabled: options.enabled ?? true,
  });
}
