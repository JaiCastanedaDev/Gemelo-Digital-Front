import { formatRelative } from '@gd/domain';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { errorMessage } from '../app/errorMessage';
import { Button } from './Button';
import styles from './DataState.module.css';
import { useNow } from './useNow';

interface DataStateProps<T> {
  query: UseQueryResult<T>;
  /** Nombre en minúscula para lectores de pantalla: "Cargando {label}". */
  label: string;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  staleAfterMs?: number;
}

export function DataState<T>({
  query,
  label,
  children,
  isEmpty,
  emptyMessage = 'No hay datos para mostrar.',
  staleAfterMs,
}: DataStateProps<T>) {
  const now = useNow();

  if (query.isPending) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={`Cargando ${label}`} />;
  }

  if (query.data === undefined) {
    return (
      <div className={styles.error} role="alert">
        <p>{errorMessage(query.error)}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const data = query.data;
  const stale = query.isError || (staleAfterMs !== undefined && now.getTime() - query.dataUpdatedAt > staleAfterMs);

  return (
    <div>
      {isEmpty?.(data) ? <p className={styles.empty}>{emptyMessage}</p> : children(data)}
      <p className={styles.meta}>
        {stale && <span className={styles.staleTag}>Dato desactualizado</span>}
        <span>Actualizado {formatRelative(new Date(query.dataUpdatedAt).toISOString(), now)}</span>
      </p>
    </div>
  );
}
