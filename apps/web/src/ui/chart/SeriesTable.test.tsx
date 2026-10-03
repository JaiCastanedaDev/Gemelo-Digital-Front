import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeriesTable } from './SeriesTable';

const t0 = Date.parse('2026-10-02T20:00:00Z');

describe('SeriesTable', () => {
  it('fecha más reciente primero, una columna por serie con unidad', () => {
    render(
      <SeriesTable
        caption="Lecturas del sensor"
        unit="g"
        series={[
          { name: 'Eje X', points: [[t0, 1], [t0 + 60_000, 2]] },
          { name: 'Eje Y', points: [[t0 + 60_000, 3]] },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Lecturas del sensor' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Fecha y hora', 'Eje X (g)', 'Eje Y (g)']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getAllByRole('cell').map((c) => c.textContent?.replace(/\s/g, ' '))).toEqual([
      expect.stringMatching(/3:01 p\. ?m\./),
      '2',
      '3',
    ]);
    expect(within(rows[1]!).getAllByRole('cell')[2]).toHaveTextContent('—');
  });

  it('limita las filas y lo dice', () => {
    const points = Array.from({ length: 300 }, (_, i): [number, number] => [t0 + i * 60_000, i]);
    render(<SeriesTable caption="Lecturas" unit={null} series={[{ name: 'CO₂', points }]} maxRows={200} />);
    expect(screen.getAllByRole('row')).toHaveLength(201);
    expect(screen.getByText('Se muestran las 200 lecturas más recientes de 300.')).toBeInTheDocument();
  });
});
