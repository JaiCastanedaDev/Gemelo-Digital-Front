import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, ToastViewport, WARNING_TOAST_MS, capToasts, useToasts, type ToastInput } from './ToastProvider';

const critical = (id: string, message = 'Aceleración superior al umbral configurado'): ToastInput => ({
  id,
  tone: 'CRITICAL',
  title: 'Alerta crítica',
  message,
  href: `/alertas?alerta=${id}`,
  actionLabel: 'Ver alerta',
});
const warning = (id: string): ToastInput => ({ id, tone: 'WARNING', title: 'Advertencia', message: `Aviso ${id}` });

let api: ReturnType<typeof useToasts> | null = null;
function Capture() {
  api = useToasts();
  return null;
}

function renderToasts() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/']}>
        <Capture />
        <ToastViewport />
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/alertas" element={<p>Página de alertas</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  return {
    show: (t: ToastInput) => act(() => api?.show(t)),
    criticalRegion: () => within(screen.getByRole('region', { name: 'Notificaciones' })).getByRole('alert'),
    warningRegion: () => within(screen.getByRole('region', { name: 'Notificaciones' })).getByRole('status'),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  api = null;
});

describe('toasts', () => {
  it('una crítica persiste y se anuncia en la región role="alert"', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1'));
    act(() => vi.advanceTimersByTime(60_000));
    expect(criticalRegion()).toHaveTextContent('Aceleración superior al umbral configurado');
  });

  it('una advertencia va a role="status" y se cierra sola a los 8 s', () => {
    const { show, warningRegion } = renderToasts();
    show(warning('w1'));
    expect(warningRegion()).toHaveTextContent('Aviso w1');
    act(() => vi.advanceTimersByTime(WARNING_TOAST_MS + 1));
    expect(warningRegion()).toBeEmptyDOMElement();
  });

  it('el mismo id reemplaza el toast en vez de duplicarlo', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1', 'primera'));
    show(critical('a1', 'segunda'));
    expect(within(criticalRegion()).getAllByText(/primera|segunda/)).toHaveLength(1);
    expect(criticalRegion()).toHaveTextContent('segunda');
  });

  it('el botón cerrar lo quita', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1'));
    fireEvent.click(within(criticalRegion()).getByRole('button', { name: 'Cerrar notificación' }));
    expect(criticalRegion()).toBeEmptyDOMElement();
  });

  it('el enlace navega y cierra el toast', () => {
    const { show, criticalRegion } = renderToasts();
    show(critical('a1'));
    fireEvent.click(within(criticalRegion()).getByRole('link', { name: 'Ver alerta' }));
    expect(screen.getByText('Página de alertas')).toBeInTheDocument();
    expect(criticalRegion()).toBeEmptyDOMElement();
  });
});

describe('clear', () => {
  it('quita todas las notificaciones y cancela los temporizadores', () => {
    const { show, criticalRegion, warningRegion } = renderToasts();
    show(critical('a1'));
    show(warning('w1'));
    act(() => api?.clear());
    expect(criticalRegion()).toBeEmptyDOMElement();
    expect(warningRegion()).toBeEmptyDOMElement();

    // Un temporizador huérfano de w1 no debe quitar un toast nuevo con el mismo id.
    show(critical('w1', 'nueva'));
    act(() => vi.advanceTimersByTime(WARNING_TOAST_MS + 1));
    expect(criticalRegion()).toHaveTextContent('nueva');
  });

  it('es referencialmente estable entre renders', () => {
    const { show } = renderToasts();
    const first = api?.clear;
    show(critical('a1'));
    expect(api?.clear).toBe(first);
  });
});

describe('capToasts', () => {
  it('descarta primero la advertencia más antigua', () => {
    const list = [critical('c3'), warning('w2'), critical('c1'), warning('w1')];
    expect(capToasts([critical('c4'), ...list], 4).map((t) => t.id)).toEqual(['c4', 'c3', 'w2', 'c1']);
  });
  it('si no hay advertencias, descarta la crítica más antigua', () => {
    expect(capToasts([critical('c3'), critical('c2'), critical('c1')], 2).map((t) => t.id)).toEqual(['c3', 'c2']);
  });
});
