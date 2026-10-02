import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

function warningId(): string {
  const found = db.alerts.find((a) => a.level === 'WARNING' && !a.acknowledged);
  if (!found) throw new Error('el escenario no tiene alerta de advertencia sin revisar');
  return found.alert_id;
}

/** Ack retenido por una compuerta que luego falla con 500. */
function gatedFailingAck() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  server.use(
    http.post('*/api/v1/alerts/:id/ack', async ({ params }) => {
      calls.push(String(params.id));
      await gate;
      return HttpResponse.json({ error: { code: 'SIMULATED_FAILURE', message: 'Falla simulada del servidor' } }, { status: 500 });
    }),
  );
  return { release, calls };
}

function listLink(alertId: string): HTMLElement {
  const link = within(screen.getByRole('list', { name: 'Alertas' }))
    .getAllByRole('link')
    .find((a) => a.getAttribute('href')?.includes(alertId));
  if (!link) throw new Error(`no hay fila para ${alertId}`);
  return link;
}

async function confirmAck(panel: ReturnType<typeof within>) {
  await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Marcar como revisada' }));
}

describe('fallo del acuse que sobrevive al cierre del panel', () => {
  it('si se cierra el panel antes de que falle, el error se avisa en las notificaciones y se revierte', async () => {
    resetDb('critico');
    const id = criticalId();
    const { release } = gatedFailingAck();
    const panel = await openDetail('admin', id);
    await confirmAck(panel);
    await waitFor(() => expect(fact(panel, 'Estado')).toHaveTextContent('Revisada'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Detalle de la alerta' })).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
    const toasts = screen.getByRole('region', { name: 'Notificaciones' });
    const toast = await within(toasts).findByText('No se pudo marcar como revisada');
    expect(toast.parentElement).toHaveTextContent(id);
    await waitFor(() => expect(within(listLink(id)).queryByText('Revisada')).not.toBeInTheDocument());
    expect(db.alerts.find((a) => a.alert_id === id)?.acknowledged).toBe(false);
  });

  it('si se cambia a otra alerta, el error de A no aparece dentro del detalle de B pero el aviso nombra a A', async () => {
    resetDb('critico');
    const idA = criticalId();
    const idB = warningId();
    const { release } = gatedFailingAck();
    const panelA = await openDetail('admin', idA);
    await confirmAck(panelA);
    await waitFor(() => expect(fact(panelA, 'Estado')).toHaveTextContent('Revisada'));

    await userEvent.click(listLink(idB));
    const panelB = within(await screen.findByRole('complementary', { name: 'Detalle de la alerta' }));
    await panelB.findByText('Cambio medido en la apertura de fisura');

    await act(async () => {
      release();
    });
    const toasts = screen.getByRole('region', { name: 'Notificaciones' });
    const toast = await within(toasts).findByText('No se pudo marcar como revisada');
    expect(toast.parentElement).toHaveTextContent(idA);
    expect(panelB.queryByRole('alert')).not.toBeInTheDocument();
    expect(fact(panelB, 'Estado')).toHaveTextContent('Sin revisar');
  });

  it('con el panel abierto el error también se muestra en línea', async () => {
    resetDb('critico');
    const { release } = gatedFailingAck();
    const panel = await openDetail('admin', criticalId());
    await confirmAck(panel);
    await act(async () => {
      release();
    });
    expect(await panel.findByRole('alert')).toHaveTextContent('No se pudo marcar la alerta como revisada.');
    const toasts = screen.getByRole('region', { name: 'Notificaciones' });
    expect(await within(toasts).findByText('No se pudo marcar como revisada')).toBeInTheDocument();
  });

  it('cambiar de alerta con el diálogo abierto lo descarta y no marca nada', async () => {
    resetDb('critico');
    const idA = criticalId();
    const idB = warningId();
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderApp(services, `/alertas?alerta=${idB}`);
    const panelB = within(await screen.findByRole('complementary', { name: 'Detalle de la alerta' }));
    await userEvent.click(await panelB.findByRole('button', { name: 'Marcar como revisada' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await userEvent.click(listLink(idA));
    const panelA = within(await screen.findByRole('complementary', { name: 'Detalle de la alerta' }));
    await panelA.findByText('Aceleración superior al umbral configurado');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(db.alerts.find((a) => a.alert_id === idA)?.acknowledged).toBe(false);
    expect(db.alerts.find((a) => a.alert_id === idB)?.acknowledged).toBe(false);
  });

  it('el acuse solo se envía una vez mientras está pendiente', async () => {
    resetDb('critico');
    const { release, calls } = gatedFailingAck();
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    const confirm = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Marcar como revisada' });
    // Síncrono: la actualización optimista aún no ocurrió (onMutate espera a cancelQueries), pero el acuse ya está pendiente.
    act(() => {
      fireEvent.click(confirm);
    });
    const pendingTrigger = await waitFor(() => {
      const button = panel.getByRole('button', { name: 'Marcar como revisada' });
      expect(button).toBeDisabled();
      return button;
    });
    expect(pendingTrigger).toBeDisabled();
    await waitFor(() => expect(fact(panel, 'Estado')).toHaveTextContent('Revisada'));
    await act(async () => {
      release();
    });
    await panel.findByRole('alert');
    expect(calls).toHaveLength(1);
  });
});

describe('foco accesible del diálogo de confirmación', () => {
  it('Tab y Shift+Tab ciclan dentro del diálogo', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    const dialog = within(screen.getByRole('alertdialog'));
    const cancel = dialog.getByRole('button', { name: 'Cancelar' });
    const confirm = dialog.getByRole('button', { name: 'Marcar como revisada' });
    expect(cancel).toHaveFocus();
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('al cancelar el foco vuelve al botón que abrió el diálogo', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    const trigger = panel.getByRole('button', { name: 'Marcar como revisada' });
    await userEvent.click(trigger);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(panel.getByRole('button', { name: 'Marcar como revisada' })).toHaveFocus();
  });

  it('al confirmar, como el botón desaparece, el foco queda en el título del detalle', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await confirmAck(panel);
    await waitFor(() => expect(fact(panel, 'Estado')).toHaveTextContent('Revisada'));
    await waitFor(() => expect(panel.getByRole('heading', { name: 'Detalle de la alerta' })).toHaveFocus());
  });
});

describe('diálogo de confirmación bajo StrictMode', () => {
  beforeEach(() => {
    configure({ reactStrictMode: true });
  });
  afterEach(() => {
    configure({ reactStrictMode: false });
  });

  it('el foco inicial queda en Cancelar', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Tab y Shift+Tab ciclan dentro del diálogo', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    const dialog = within(screen.getByRole('alertdialog'));
    const cancel = dialog.getByRole('button', { name: 'Cancelar' });
    const confirm = dialog.getByRole('button', { name: 'Marcar como revisada' });
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('al cancelar el foco vuelve al botón que abrió el diálogo', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await userEvent.click(panel.getByRole('button', { name: 'Marcar como revisada' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(panel.getByRole('button', { name: 'Marcar como revisada' })).toHaveFocus());
  });

  it('al confirmar el foco queda en el título del detalle', async () => {
    resetDb('critico');
    const panel = await openDetail('admin', criticalId());
    await confirmAck(panel);
    await waitFor(() => expect(fact(panel, 'Estado')).toHaveTextContent('Revisada'));
    await waitFor(() => expect(panel.getByRole('heading', { name: 'Detalle de la alerta' })).toHaveFocus());
  });
});
