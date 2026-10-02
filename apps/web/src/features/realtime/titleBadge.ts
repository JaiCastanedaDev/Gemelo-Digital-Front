import type { AlertLevel } from '@gd/domain';
import { useCallback, useEffect, useRef } from 'react';

export const BASE_TITLE = 'Gemelo Digital';

export function badgeTitle(base: string, count: number, hasCritical: boolean): string {
  if (count <= 0) return base;
  return `(${count}) ⚠ ${hasCritical ? 'Alerta crítica' : 'Nueva alerta'} · ${base}`;
}

/** Marca el título de la pestaña cuando llegan alertas con la pestaña oculta. */
export function useTitleBadge(): (level: AlertLevel) => void {
  const pending = useRef({ count: 0, critical: false });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      pending.current = { count: 0, critical: false };
      document.title = BASE_TITLE;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return useCallback((level: AlertLevel) => {
    if (document.visibilityState !== 'hidden') return;
    pending.current = {
      count: pending.current.count + 1,
      critical: pending.current.critical || level === 'CRITICAL',
    };
    document.title = badgeTitle(BASE_TITLE, pending.current.count, pending.current.critical);
  }, []);
}
