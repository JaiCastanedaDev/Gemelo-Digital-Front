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
