import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { STATUS_META } from '../statusMeta';
import styles from './Toast.module.css';

export type ToastTone = 'CRITICAL' | 'WARNING';

export interface ToastInput {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
}

export const WARNING_TOAST_MS = 8_000;
export const MAX_TOASTS = 4;

interface ToastContextValue {
  toasts: ToastInput[];
  show(toast: ToastInput): void;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Limita la pila descartando primero las advertencias más antiguas. */
export function capToasts(list: ToastInput[], max: number = MAX_TOASTS): ToastInput[] {
  const result = [...list];
  while (result.length > max) {
    const oldestWarning = result.findLastIndex((t) => t.tone === 'WARNING');
    result.splice(oldestWarning === -1 ? result.length - 1 : oldestWarning, 1);
  }
  return result;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastInput[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const previous = timersRef.current.get(toast.id);
      if (previous) {
        clearTimeout(previous);
        timersRef.current.delete(toast.id);
      }
      if (toast.tone === 'WARNING') {
        timersRef.current.set(
          toast.id,
          setTimeout(() => dismiss(toast.id), WARNING_TOAST_MS),
        );
      }
      setToasts((prev) => capToasts([toast, ...prev.filter((t) => t.id !== toast.id)]));
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToasts debe usarse dentro de <ToastProvider>');
  return value;
}

function ToastCard({ toast, onDismiss }: { toast: ToastInput; onDismiss: (id: string) => void }) {
  const { Icon } = STATUS_META[toast.tone];
  return (
    <div className={styles.toast} data-tone={toast.tone}>
      <Icon aria-hidden="true" size={22} />
      <div>
        <p className={styles.title}>{toast.title}</p>
        <p className={styles.message}>{toast.message}</p>
        {toast.href && (
          <Link to={toast.href} className={styles.action} onClick={() => onDismiss(toast.id)}>
            {toast.actionLabel ?? 'Ver'}
          </Link>
        )}
      </div>
      <button type="button" className={styles.close} aria-label="Cerrar notificación" onClick={() => onDismiss(toast.id)}>
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

/** Las dos regiones vivas están siempre montadas para que los lectores de pantalla anuncien lo nuevo. */
export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  return (
    <section className={styles.viewport} aria-label="Notificaciones">
      <div role="alert">
        {toasts
          .filter((t) => t.tone === 'CRITICAL')
          .map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
      </div>
      <div role="status">
        {toasts
          .filter((t) => t.tone === 'WARNING')
          .map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
      </div>
    </section>
  );
}
