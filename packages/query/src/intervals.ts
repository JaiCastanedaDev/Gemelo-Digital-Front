/** Intervalos de polling (spec §8.1). TanStack Query los pausa con la pestaña oculta. */
export const POLL_INTERVALS_MS = {
  dashboardGeneral: 30_000,
  dashboardComfort: 30_000,
  dashboardStructural: 60_000,
  sensors: 60_000,
  alerts: 60_000,
  dashboardConsumption: 300_000,
} as const;
