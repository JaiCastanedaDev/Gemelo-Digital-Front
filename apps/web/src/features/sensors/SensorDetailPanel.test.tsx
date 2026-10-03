import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RangeKey } from '@gd/domain';
import { resetDb } from '../../mocks/db';
import { server } from '../../mocks/server';
import { createTestServices, loginAs, renderInApp } from '../../test/renderApp';
import { SensorDetailPanel } from './SensorDetailPanel';

function Harness({ sensorId, onClose = () => {} }: { sensorId: string; onClose?: () => void }) {
  const [range, setRange] = useState<RangeKey>('24h');
  return <SensorDetailPanel sensorId={sensorId} range={range} onRangeChange={setRange} onClose={onClose} />;
}

async function open(sensorId: string, onClose?: () => void) {
  const services = createTestServices();
  await loginAs(services, 'admin');
  renderInApp(services, <Harness sensorId={sensorId} onClose={onClose} />);
  return within(await screen.findByRole('complementary', { name: 'Detalle del sensor' }));
}

describe('SensorDetailPanel', () => {
  it('muestra datos, estado, alertas y la serie con alternativa en tabla', async () => {
    resetDb('critico');
    const panel = await open('acc-t1-sotano');
    expect(await panel.findByRole('heading', { name: 'Acelerómetro Sótano Torre 1' })).toBeInTheDocument();
    expect(panel.getAllByText('Crítico').length).toBeGreaterThan(0);
    expect(panel.getByRole('link', { name: /Aceleración superior al umbral configurado/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/alertas\?alerta=alrt-\d{8}-00004$/),
    );
    expect(panel.getByRole('link', { name: 'Ver en 3D' })).toHaveAttribute('href', '/gemelo?sensor=acc-t1-sotano');
    expect(await panel.findByRole('img', { name: 'Serie de Acelerómetro Sótano Torre 1, 24 horas' })).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'Ver como tabla' }));
    const table = panel.getByRole('table', { name: 'Lecturas de Acelerómetro Sótano Torre 1' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha y hora',
      'Eje X (g)',
      'Eje Y (g)',
      'Eje Z (g)',
    ]);
  });

  it('cambiar el rango actualiza la serie', async () => {
    const panel = await open('water-main');
    await panel.findByRole('img', { name: /24 horas/ });
    await userEvent.click(panel.getByRole('button', { name: '1 hora' }));
    expect(await panel.findByRole('img', { name: 'Serie de Medidor acueducto principal, 1 hora' })).toBeInTheDocument();
  });

  it('un sensor sin datos lo dice y no se ve como normal', async () => {
    resetDb('caido');
    // Los tramos diarios se cachean: la lectura vacía se simula antes de abrir el panel.
    server.use(http.get('*/api/v1/sensors/:id/data', () => HttpResponse.json([])));
    const panel = await open('acc-t2-sotano');
    expect(await panel.findByText(/^Sin datos desde/)).toBeInTheDocument();
    expect(panel.queryByText('Normal')).not.toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: '1 hora' }));
    expect(await panel.findByText('Sin lecturas en este rango.')).toBeInTheDocument();
  });

  it('el fisurómetro muestra el cambio medido en el periodo', async () => {
    const panel = await open('crack-t1-sotano');
    expect(await panel.findByText(/^Cambio medido en el periodo: [+−]\d/)).toBeInTheDocument();
  });

  it('un sensor inexistente lo dice', async () => {
    const services = createTestServices();
    await loginAs(services, 'admin');
    renderInApp(services, <Harness sensorId="no-existe" />);
    expect(await screen.findByText('No encontramos este sensor.')).toBeInTheDocument();
  });

  it('Escape cierra', async () => {
    const onClose = vi.fn();
    await open('water-main', onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
