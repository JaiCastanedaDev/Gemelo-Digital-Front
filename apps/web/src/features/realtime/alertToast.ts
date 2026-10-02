import type { AlertResidente } from '@gd/api';
import type { ToastInput } from '../../ui/toast/ToastProvider';

export function alertToast(alert: AlertResidente): ToastInput {
  const tone = alert.level === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
  return {
    id: alert.alert_id,
    tone,
    title: tone === 'CRITICAL' ? 'Alerta crítica' : 'Advertencia',
    message: alert.message,
    href: `/alertas?alerta=${encodeURIComponent(alert.alert_id)}`,
    actionLabel: 'Ver alerta',
  };
}
