import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { db, resetDb } from '../../mocks/db';
import { emitMockAlert } from '../../mocks/emit';
import { server } from '../../mocks/server';
import { homeReady } from '../../test/homeReady';
import { createTestServices, loginAs, renderApp } from '../../test/renderApp';

function criticalId(): string {
  const found = db.alerts.find((a) => a.level === 'CRITICAL');
  if (!found) throw new Error('el escenario no tiene alerta crítica');
  return found.alert_id;
}

async function openDetail(who: 'admin' | 'residente', alertId: string) {
  const services = createTestServices();
  await loginAs(services, who);
  renderApp(services, `/alertas?alerta=${alertId}`);
  const panel = await screen.findByRole('complementary', { name: 'Detalle de la alerta' });
  await within(panel).findByText('Aceleración superior al umbral configurado');
  return within(panel);
}

function fact(panel: ReturnType<typeof within>, term: string) {
  const dt = panel.getByText(term, { selector: 'dt' });
  return dt.nextElementSibling;
}

describe('detalle de alerta', () => {
  it('el administrador ve valor medido, umbral y ocurrencias', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    expect(fact(panel, 'Valor medido')).toHaveTextContent('0,35');
    expect(fact(panel, 'Umbral configurado')).toHaveTextContent('0,2');
    expect(fact(panel, 'Ocurrencias')).toHaveTextContent('12');
    expect(fact(panel, 'Estado')).toHaveTextContent('Sin revisar');
  });

  it('el residente no ve números ni puede marcarla', async () => {
    resetDb('critico');
    const panel = await openDetail('residente', criticalId());
    expect(panel.queryByText('Valor medido')).not.toBeInTheDocument();
    expect(panel.queryByText('Umbral configurado')).not.toBeInTheDocument();
    expect(panel.queryByText('Ocurrencias')).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Marcar como revisada' })).not.toBeInTheDocument();
    expect(panel.queryByRole('link', { name: 'Ver sensor' })).not.toBeInTheDocument();
    expect(panel.queryByRole('link', { name: 'Ver en 3D' })).not.toBeInTheDocument();
    expect(panel.queryByRole('link', { name: 'Crear tarea de mantenimiento' })).not.toBeInTheDocument();
  });

  it('marca como revisada al instante y confirma con el servidor', async () => {
    resetDb('critico');
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/api/v1/alerts/:id/ack', async ({ params }) => {
        await gate;
        const alert = db.alerts.find((a) => a.alert_id === String(params.id));
        if (!alert) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });
        Object.assign(alert, { acknowledged: true, acknowledged_by: 'Administración Demo', acknowledged_at: new Date().toISOString() });
        return HttpResponse.json(alert);
      }),
    );
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Marcar esta alerta como revisada?' });
    expect(dialog).toHaveTextContent('Esto no resuelve la condición; si persiste, se volverá a registrar.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como revisada' }));

    // El servidor sigue retenido por `gate`: lo que se ve es la actualización optimista.
    await waitFor(() => expect(fact(panel, 'Estado')).toHaveTextContent('Revisada'));
    expect(panel.queryByRole('button', { name: 'Marcar como revisada' })).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
    expect(await panel.findByText('Administración Demo')).toBeInTheDocument();
  });

  it('si el servidor falla revierte y lo dice', async () => {
    resetDb('critico');
    db.settings.failNextAck = true;
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Marcar como revisada' }));
    expect(await panel.findByRole('alert')).toHaveTextContent('No se pudo marcar la alerta como revisada.');
    expect(fact(panel, 'Estado')).toHaveTextContent('Sin revisar');
  });

  it('cancelar el diálogo no envía nada', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fact(panel, 'Estado')).toHaveTextContent('Sin revisar');
    expect(db.alerts.find((a) => a.alert_id === criticalId())?.acknowledged).toBe(false);
  });

  it('Escape con el diálogo abierto solo lo cancela y no cierra el detalle', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Detalle de la alerta' })).toBeInTheDocument();
  });

  it('Escape cierra el detalle', async () => {
    resetDb('critico');
    await openDetail('admin', criticalId());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Detalle de la alerta' })).not.toBeInTheDocument();
  });

  it('una alerta inexistente lo dice sin romper', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/alertas?alerta=alrt-00000000-99999');
    expect(await screen.findByText('No encontramos esta alerta. Puede que ya no exista.')).toBeInTheDocument();
  });

  it('desde el banner del home se llega al detalle en un clic', async () => {
    resetDb('critico');
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    const banner = await screen.findByRole('region', { name: 'Alertas críticas sin revisar' });
    await userEvent.click(within(banner).getByRole('link', { name: 'Ver alerta' }));
    expect(await screen.findByRole('complementary', { name: 'Detalle de la alerta' })).toBeInTheDocument();
  });

  it('abrir la alerta cierra su notificación', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, '/');
    await homeReady();
    act(() => {
      emitMockAlert({ level: 'CRITICAL' });
    });
    const toasts = screen.getByRole('region', { name: 'Notificaciones' });
    await userEvent.click(within(toasts).getByRole('link', { name: 'Ver alerta' }));
    await screen.findByRole('complementary', { name: 'Detalle de la alerta' });
    expect(within(toasts).getByRole('alert')).toBeEmptyDOMElement();
  });
});
