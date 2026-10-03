import { STATUS_ORDER, formatNumber, type StatusLevel, type ZoneDensity } from '@gd/domain';
import type { EChartsCoreOption } from 'echarts/core';
import { STATUS_META } from '../statusMeta';
import { DEFAULT_CHART_THEME, type ChartTheme } from './palette';
import { escapeHtml } from './timeSeriesOption';

function densityTooltipHtml(params: unknown): string {
  const items = Array.isArray(params) ? params : [params];
  let zone = '';
  const rows: string[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const { name, seriesName, value } = item as { name?: unknown; seriesName?: unknown; value?: unknown };
    zone = String(name ?? zone);
    rows.push(`${escapeHtml(String(seriesName ?? ''))}: ${escapeHtml(String(value ?? 0))}`);
  }
  return [escapeHtml(zone), ...rows].join('<br/>');
}

export function buildDensityOption(
  zones: ZoneDensity[],
  palette: Record<StatusLevel, string>,
  theme: ChartTheme = DEFAULT_CHART_THEME,
): EChartsCoreOption {
  return {
    textStyle: { color: theme.text },
    animation: false,
    grid: { left: 140, right: 16, top: 36, bottom: 24 },
    legend: { top: 0, textStyle: { color: theme.text } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: unknown) => densityTooltipHtml(params) },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.border } },
      splitLine: { lineStyle: { color: theme.border } },
    },
    yAxis: { type: 'category', data: zones.map((z) => z.zone), axisLabel: { color: theme.muted, width: 128, overflow: 'truncate' },
      axisLine: { lineStyle: { color: theme.border } },
    },
    series: STATUS_ORDER.map((level) => ({
      name: STATUS_META[level].label,
      type: 'bar',
      stack: 'total',
      itemStyle: { color: palette[level] },
      data: zones.map((z) => z.counts[level]),
    })),
  };
}

export function buildComparisonOption(input: {
  unit: string;
  current: number;
  previous: number | null;
  palette: string[];
  theme?: ChartTheme;
}): EChartsCoreOption {
  const theme = input.theme ?? DEFAULT_CHART_THEME;
  const bars = [
    ...(input.previous === null ? [] : [{ label: 'Mes anterior (mismo tramo)', value: input.previous, color: input.palette[1] }]),
    { label: 'Mes en curso', value: input.current, color: input.palette[0] },
  ];
  return {
    animation: false,
    textStyle: { color: theme.text },
    grid: { left: 72, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { name?: string; value?: number }) =>
        `${escapeHtml(p.name ?? '')}: ${escapeHtml(formatNumber(p.value ?? 0))} ${escapeHtml(input.unit)}`,
    },
    xAxis: {
      type: 'category',
      data: bars.map((b) => b.label),
      axisLabel: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.border } },
    },
    yAxis: {
      type: 'value',
      name: input.unit,
      nameTextStyle: { color: theme.muted },
      axisLabel: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.border } },
      splitLine: { lineStyle: { color: theme.border } },
    },
    series: [{ type: 'bar', barMaxWidth: 48, data: bars.map((b) => ({ value: b.value, itemStyle: { color: b.color } })) }],
  };
}
