/* eslint-disable @typescript-eslint/no-explicit-any -- inspección de la opción de ECharts en tests */
import { describe, expect, it } from 'vitest';
import { buildTimeSeriesOption, escapeHtml } from './timeSeriesOption';

const t0 = Date.parse('2026-10-02T10:00:00Z');
const base = {
  unit: 'g',
  palette: ['#111', '#222', '#333'],
  spanMs: 3_600_000,
  series: [{ name: 'Eje X', points: [[t0, 1], [t0 + 60_000, 2]] as [number, number][] }],
};

describe('buildTimeSeriesOption', () => {
  it('eje temporal, unidad en el eje Y y una serie de línea sin símbolos', () => {
    const option = buildTimeSeriesOption(base) as Record<string, any>;
    expect(option.xAxis.type).toBe('time');
    expect(option.yAxis.name).toBe('g');
    expect(option.series).toHaveLength(1);
    expect(option.series[0]).toMatchObject({ type: 'line', name: 'Eje X', showSymbol: false });
    expect(option.series[0].data).toEqual(base.series[0]?.points);
    expect(option.legend.show).toBe(false);
  });

  it('muestra la leyenda con varias series y las marcas de alerta en la primera', () => {
    const option = buildTimeSeriesOption({
      ...base,
      series: [...base.series, { name: 'Eje Y', points: [] }],
      markers: [{ t: t0, label: 'Crítico' }],
    }) as Record<string, any>;
    expect(option.legend.data).toEqual(['Eje X', 'Eje Y']);
    expect(option.series[0].markLine.data).toEqual([{ name: 'Crítico', xAxis: t0 }]);
    expect(option.series[1].markLine).toBeUndefined();
  });

  it('el tooltip formatea en hora de Bogotá y escapa el texto', () => {
    const option = buildTimeSeriesOption({ ...base, unit: '<b>g</b>' }) as Record<string, any>;
    const html: string = option.tooltip.formatter([{ seriesName: 'Eje <X>', value: [t0, 1.23456] }]);
    expect(html).toContain('Eje &lt;X&gt;');
    expect(html).toContain('&lt;b&gt;g&lt;/b&gt;');
    expect(html).toContain('1,235');
    expect(html).not.toContain('<b>');
  });

  it('los formateadores de eje no fallan con valores no finitos', () => {
    const option = buildTimeSeriesOption(base) as Record<string, any>;
    expect(option.xAxis.axisLabel.formatter(Number.NaN)).toBe('');
    expect(option.dataZoom[1].labelFormatter(Number.POSITIVE_INFINITY)).toBe('');
    expect(option.xAxis.axisLabel.formatter(t0)).not.toBe('');
  });

  it('aplica los colores del tema a texto, ejes y deslizador', () => {
    const theme = { text: '#aaa', muted: '#bbb', border: '#ccc' };
    const option = buildTimeSeriesOption({ ...base, theme }) as Record<string, any>;
    expect(option.textStyle.color).toBe('#aaa');
    expect(option.xAxis.axisLabel.color).toBe('#bbb');
    expect(option.yAxis.axisLabel.color).toBe('#bbb');
    expect(option.yAxis.splitLine.lineStyle.color).toBe('#ccc');
    expect(option.dataZoom[1].textStyle.color).toBe('#bbb');
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});
