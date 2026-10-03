/* eslint-disable @typescript-eslint/no-explicit-any -- inspección de la opción de ECharts en tests */
import { describe, expect, it } from 'vitest';
import { buildComparisonOption, buildDensityOption } from './barOptions';

const palette = { CRITICAL: '#c', WARNING: '#w', INFO: '#i', OK: '#o', OFFLINE: '#f' };

describe('buildDensityOption', () => {
  it('una serie apilada por estado con nombre de texto y las zonas como categorías', () => {
    const option = buildDensityOption(
      [{ zone: 'Lobby', total: 2, counts: { CRITICAL: 1, WARNING: 0, INFO: 0, OK: 1, OFFLINE: 0 } }],
      palette,
    ) as Record<string, any>;
    expect(option.yAxis.data).toEqual(['Lobby']);
    expect(option.series.map((s: any) => s.name)).toEqual(['Crítico', 'Advertencia', 'Sin datos', 'Informativo', 'Normal']);
    expect(option.series.every((s: any) => s.stack === 'total' && s.type === 'bar')).toBe(true);
    expect(option.series[0].data).toEqual([1]);
  });
});

describe('buildComparisonOption', () => {
  it('dos barras con el mes anterior y el actual', () => {
    const option = buildComparisonOption({ unit: 'm³', current: 1234.5, previous: 1100.2, palette: ['#1', '#2'] }) as Record<string, any>;
    expect(option.xAxis.data).toEqual(['Mes anterior (mismo tramo)', 'Mes en curso']);
    expect(option.series[0].data.map((d: any) => d.value)).toEqual([1100.2, 1234.5]);
  });
  it('sin periodo anterior solo hay una barra', () => {
    const option = buildComparisonOption({ unit: 'kWh', current: 8420, previous: null, palette: ['#1', '#2'] }) as Record<string, any>;
    expect(option.xAxis.data).toEqual(['Mes en curso']);
  });
  it('el tooltip escapa la unidad y el nombre', () => {
    const option = buildComparisonOption({ unit: '<i>u</i>', current: 1, previous: null, palette: ['#1', '#2'] }) as Record<string, any>;
    const html: string = option.tooltip.formatter({ name: '<b>x</b>', value: 1 });
    expect(html).not.toContain('<');
    expect(html).toContain('&lt;i&gt;u&lt;/i&gt;');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
