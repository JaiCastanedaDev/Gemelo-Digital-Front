import type { UseQueryResult } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@gd/api';
import { DataState } from './DataState';

function fakeQuery<T>(partial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    data: undefined,
    error: null,
    dataUpdatedAt: Date.now(),
    refetch: vi.fn(),
    ...partial,
  } as unknown as UseQueryResult<T>;
}

describe('DataState', () => {
  it('cargando: muestra un estado ocupado accesible', () => {
    render(<DataState label="sensores" query={fakeQuery<number[]>({ isPending: true })}>{() => null}</DataState>);
    expect(screen.getByRole('status', { name: 'Cargando sensores' })).toHaveAttribute('aria-busy', 'true');
  });

  it('error sin datos: mensaje y botón Reintentar', async () => {
    const refetch = vi.fn();
    const error = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' });
    render(
      <DataState label="sensores" query={fakeQuery<number[]>({ isError: true, error, refetch })}>
        {() => null}
      </DataState>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('con datos: renderiza el contenido y la antigüedad', () => {
    render(
      <DataState label="sensores" query={fakeQuery({ data: [1, 2] })}>
        {(data) => <p>{data.length} sensores</p>}
      </DataState>,
    );
    expect(screen.getByText('2 sensores')).toBeInTheDocument();
    expect(screen.getByText(/Actualizado justo ahora/)).toBeInTheDocument();
  });

  it('vacío: muestra el mensaje propio', () => {
    render(
      <DataState
        label="sensores"
        query={fakeQuery({ data: [] as number[] })}
        isEmpty={(d) => d.length === 0}
        emptyMessage="Aún no hay sensores."
      >
        {() => <p>contenido</p>}
      </DataState>,
    );
    expect(screen.getByText('Aún no hay sensores.')).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });

  it('marca el dato como desactualizado si supera el límite o si falló el refresco', () => {
    const { rerender } = render(
      <DataState label="x" staleAfterMs={60_000} query={fakeQuery({ data: 1, dataUpdatedAt: Date.now() - 120_000 })}>
        {() => <p>dato</p>}
      </DataState>,
    );
    expect(screen.getByText('Dato desactualizado')).toBeInTheDocument();
    rerender(
      <DataState label="x" query={fakeQuery({ data: 1, isError: true, error: new Error('x') })}>
        {() => <p>dato</p>}
      </DataState>,
    );
    expect(screen.getByText('Dato desactualizado')).toBeInTheDocument();
  });
});
