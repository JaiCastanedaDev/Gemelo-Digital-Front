import { formatAxisTick, formatDateTime, formatNumber, type SeriesPoint } from '@gd/domain';
import type { EChartsCoreOption } from 'echarts/core';

export interface ChartSeries {
  name: string;
  points: SeriesPoint[];
}

export interface ChartMarker {
  t: number;
  label: string;
}

export interface TimeSeriesOptionInput {
  series: ChartSeries[];
  unit: string | null;
  palette: string[];
  spanMs: number;
  markers?: ChartMarker[];
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** El tooltip de ECharts es HTML: todo texto se escapa. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function tooltipHtml(params: unknown, unit: string | null): string {
  const items = Array.isArray(params) ? params : [params];
  let time = '';
  const rows: string[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const { seriesName, value } = item as { seriesName?: unknown; value?: unknown };
    if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number') continue;
    if (!Number.isFinite(value[0])) continue;
    time = formatDateTime(new Date(value[0]).toISOString());
    const suffix = unit ? ` ${escapeHtml(unit)}` : '';
    rows.push(`${escapeHtml(String(seriesName ?? ''))}: ${escapeHtml(formatNumber(value[1], 3))}${suffix}`);
  }
  return [escapeHtml(time), ...rows].join('<br/>');
}

function tickLabel(value: number, spanMs: number): string {
  return Number.isFinite(value) ? formatAxisTick(value, spanMs) : '';
}

export function buildTimeSeriesOption(input: TimeSeriesOptionInput): EChartsCoreOption {
  const multiple = input.series.length > 1;
  const markers = input.markers ?? [];
  return {
    animation: false,
    color: input.palette,
    grid: { left: 64, right: 16, top: multiple ? 36 : 16, bottom: 64 },
    legend: multiple ? { top: 0, data: input.series.map((s) => s.name) } : { show: false },
    tooltip: { trigger: 'axis', formatter: (params: unknown) => tooltipHtml(params, input.unit) },
    xAxis: {
      type: 'time',
      axisLabel: { hideOverlap: true, formatter: (value: number) => tickLabel(value, input.spanMs) },
    },
    yAxis: {
      type: 'value',
      name: input.unit ?? '',
      scale: true,
      axisLabel: { formatter: (value: number) => formatNumber(value, 3) },
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', height: 20, bottom: 8, labelFormatter: (value: number) => tickLabel(value, input.spanMs) },
    ],
    series: input.series.map((s, index) => ({
      name: s.name,
      type: 'line',
      showSymbol: false,
      lineStyle: { width: 1.5 },
      data: s.points,
      markLine:
        index === 0 && markers.length > 0
          ? {
              symbol: 'none',
              silent: true,
              label: { formatter: '{b}' },
              data: markers.map((m) => ({ name: m.label, xAxis: m.t })),
            }
          : undefined,
    })),
  };
}
