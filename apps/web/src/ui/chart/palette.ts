import type { StatusLevel } from '@gd/domain';

export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function seriesPalette(): string[] {
  return [cssVar('--chart-1', '#175cd3'), cssVar('--chart-2', '#b42318'), cssVar('--chart-3', '#067647')];
}

export function statusPalette(): Record<StatusLevel, string> {
  return {
    CRITICAL: cssVar('--status-critical-fg', '#b42318'),
    WARNING: cssVar('--status-warning-fg', '#93370d'),
    INFO: cssVar('--status-info-fg', '#175cd3'),
    OK: cssVar('--status-ok-fg', '#067647'),
    OFFLINE: cssVar('--status-offline-fg', '#344054'),
  };
}
