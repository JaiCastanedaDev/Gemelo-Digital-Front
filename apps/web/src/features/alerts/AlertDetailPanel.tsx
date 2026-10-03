import { ContractDriftError, isAdminAlert, type AlertResidente, type Role } from '@gd/api';
import { formatDateTime, formatNumber } from '@gd/domain';
import { useAckAlert, useAlerts } from '@gd/query';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../../app/errorMessage';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { StatusBadge } from '../../ui/StatusBadge';
import { useToasts } from '../../ui/toast/ToastProvider';
import { categoryLabel } from './alertCopy';
import styles from './Alerts.module.css';

interface AlertDetailPanelProps {
  alertId: string;
  role: Role;
  onClose: () => void;
}

export function AlertDetailPanel({ alertId, role, onClose }: AlertDetailPanelProps) {
  const all = useAlerts(role, {});
  const ack = useAckAlert();
  const { dismiss, show } = useToasts();
  const [confirming, setConfirming] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);
  const focusHeadingAfterAck = useRef(false);
  const alert = all.data?.data.find((a) => a.alert_id === alertId);
  const isAcknowledged = alert?.acknowledged ?? false;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
    dismiss(alertId); // abrir la alerta cierra su notificación persistente
  }, [alertId, dismiss]);

  // Al revisar la alerta desaparece el botón que tenía el foco: lo llevamos al título del detalle.
  useEffect(() => {
    if (isAcknowledged && focusHeadingAfterAck.current) {
      focusHeadingAfterAck.current = false;
      headingRef.current?.focus();
    }
  }, [isAcknowledged]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirming, onClose]);

  function confirmAck(target: AlertResidente) {
    if (ack.isPending) return;
    setConfirming(false);
    setAckError(null);
    focusHeadingAfterAck.current = true;
    // mutateAsync (y no las opciones de mutate) para que el fallo se informe aunque el panel ya se haya cerrado.
    ack.mutateAsync(target.alert_id).catch((error: unknown) => {
      // Respuesta fuera de contrato: el servidor pudo acusar; la invalidación reconcilia y no se muestra un fallo falso.
      if (error instanceof ContractDriftError) return;
      const reason = errorMessage(error);
      focusHeadingAfterAck.current = false;
      show({
        id: `ack-error-${target.alert_id}`,
        tone: 'WARNING',
        title: 'No se pudo marcar como revisada',
        message: `${target.message} (${target.alert_id}). ${reason}`,
      });
      if (mountedRef.current) setAckError(`No se pudo marcar la alerta como revisada. ${reason}`);
    });
  }

  return (
    <aside className={styles.detail} aria-labelledby="alert-detail-title">
      <div className={styles.detailHeader}>
        <h2 id="alert-detail-title" ref={headingRef} tabIndex={-1}>
          Detalle de la alerta
        </h2>
        <button type="button" className={styles.close} aria-label="Cerrar detalle" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      {all.isPending ? (
        <p role="status">Cargando alerta…</p>
      ) : all.isError && !all.data ? (
        <p className={styles.error}>{errorMessage(all.error)}</p>
      ) : !alert ? (
        <p>No encontramos esta alerta. Puede que ya no exista.</p>
      ) : (
        <>
          <StatusBadge level={alert.level} />
          <p className={styles.detailMessage}>{alert.message}</p>
          <dl className={styles.facts}>
            <dt>Fecha</dt>
            <dd>{formatDateTime(alert.timestamp)}</dd>
            <dt>Categoría</dt>
            <dd>{categoryLabel(alert.category)}</dd>
            <dt>Sensor</dt>
            <dd>{alert.sensor_id}</dd>
            <dt>Estado</dt>
            <dd>{alert.acknowledged ? 'Revisada' : 'Sin revisar'}</dd>
            {role === 'ADMIN' && isAdminAlert(alert) && (
              <>
                <dt>Valor medido</dt>
                <dd>{formatNumber(alert.value_triggered, 2)}</dd>
                <dt>Umbral configurado</dt>
                <dd>{formatNumber(alert.threshold_configured, 2)}</dd>
                <dt>Ocurrencias</dt>
                <dd>{alert.occurrence_count}</dd>
                {alert.acknowledged && (
                  <>
                    <dt>Revisada por</dt>
                    <dd>{alert.acknowledged_by ?? '—'}</dd>
                    <dt>Revisada el</dt>
                    <dd>{formatDateTime(alert.acknowledged_at)}</dd>
                  </>
                )}
              </>
            )}
          </dl>

          {ackError && (
            <p className={styles.error} role="alert">
              {ackError}
            </p>
          )}

          {role === 'ADMIN' && (
            <div className={styles.actions}>
              {!alert.acknowledged && (
                <Button disabled={ack.isPending} onClick={() => setConfirming(true)}>
                  Marcar como revisada
                </Button>
              )}
              <Link to={`/sensores?sensor=${encodeURIComponent(alert.sensor_id)}`}>Ver sensor</Link>
              <Link to={`/gemelo?sensor=${encodeURIComponent(alert.sensor_id)}`}>Ver en 3D</Link>
              <Link
                to={`/mantenimiento?nueva=1&descripcion=${encodeURIComponent(
                  `Revisar sensor ${alert.sensor_id} – alerta ${alert.alert_id}`,
                )}`}
              >
                Crear tarea de mantenimiento
              </Link>
            </div>
          )}

          {confirming && (
            <ConfirmDialog
              title="¿Marcar esta alerta como revisada?"
              description="Esto no resuelve la condición; si persiste, se volverá a registrar."
              confirmLabel="Marcar como revisada"
              restoreFocusTo={() => headingRef.current}
              onCancel={() => setConfirming(false)}
              onConfirm={() => confirmAck(alert)}
            />
          )}
        </>
      )}
    </aside>
  );
}
