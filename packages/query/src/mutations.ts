import { ContractDriftError, type AlertAdmin, type AlertListResidente } from '@gd/api';
import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from '@tanstack/react-query';
import { useApi } from './ApiContext';
import { acknowledgeInList, applyAlertToCache, filtersFromKey } from './alertCache';
import { queryKeys } from './keys';

export interface AckContext {
  snapshot: [QueryKey, AlertListResidente | undefined][];
}

/** Acuse optimista: la alerta pasa a revisada al instante y se revierte si el servidor falla. */
export function useAckAlert(): UseMutationResult<AlertAdmin, unknown, string, AckContext> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<AlertAdmin, unknown, string, AckContext>({
    mutationFn: (alertId) => api.alerts.ack(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.alerts.all() });
      const snapshot = queryClient.getQueriesData<AlertListResidente>({ queryKey: queryKeys.alerts.all() });
      for (const [key, list] of snapshot) {
        if (list) queryClient.setQueryData(key, acknowledgeInList(list, alertId, filtersFromKey(key)));
      }
      return { snapshot };
    },
    onError: (error, _alertId, context) => {
      // El servidor pudo haber acusado aunque su respuesta no cumpla el contrato: se conserva lo optimista y onSettled reconcilia.
      if (error instanceof ContractDriftError) return;
      for (const [key, list] of context?.snapshot ?? []) queryClient.setQueryData(key, list);
    },
    onSuccess: (updated) => applyAlertToCache(queryClient, 'ADMIN', updated),
    // Las invalidaciones se lanzan sin esperarlas: así el resultado (y su mensaje de error) no depende de los refetch.
    onSettled: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.general() }),
        // El estado de cada sensor depende de sus alertas sin revisar (spec §5.3).
        queryClient.invalidateQueries({ queryKey: queryKeys.sensors.list() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.structural() }),
      ]);
    },
  });
}
