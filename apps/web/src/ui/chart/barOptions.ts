import { STATUS_ORDER, formatNumber, type StatusLevel, type ZoneDensity } from '@gd/domain';
import type { EChartsCoreOption } from 'echarts/core';
import { STATUS_META } from '../statusMeta';
import { escapeHtml } from './timeSeriesOption';

export function buildDensityOption(zones: ZoneDensity[], palette: Record<StatusLevel, string>): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: 140, right: 16, top: 36, bottom: 24 },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: zones.map((z) => z.zone), axisLabel: { width: 128, overflow: 'truncate' } },
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
}): EChartsCoreOption {
  const bars = [
    ...(input.previous === null ? [] : [{ label: 'Mes anterior (mismo tramo)', value: input.previous, color: input.palette[1] }]),
    { label: 'Mes en curso', value: input.current, color: input.palette[0] },
  ];
  return {
    animation: false,
    grid: { left: 72, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { name?: string; value?: number }) =>
        `${escapeHtml(p.name ?? '')}: ${escapeHtml(formatNumber(p.value ?? 0))} ${escapeHtml(input.unit)}`,
    },
    xAxis: { type: 'category', data: bars.map((b) => b.label) },
    yAxis: { type: 'value', name: input.unit },
    series: [{ type: 'bar', barMaxWidth: 48, data: bars.map((b) => ({ value: b.value, itemStyle: { color: b.color } })) }],
  };
}
