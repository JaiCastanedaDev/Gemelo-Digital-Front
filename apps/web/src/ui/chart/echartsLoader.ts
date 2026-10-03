export type EChartsModule = typeof import('echarts/core');

let loading: Promise<EChartsModule> | null = null;

/** Carga diferida y modular: solo los componentes que usa la app (el bundle inicial no incluye ECharts). */
export function loadECharts(): Promise<EChartsModule> {
  loading ??= Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]).then(([core, charts, components, renderers]) => {
    core.use([
      charts.LineChart,
      charts.BarChart,
      components.GridComponent,
      components.TooltipComponent,
      components.DataZoomComponent,
      components.LegendComponent,
      components.MarkLineComponent,
      renderers.CanvasRenderer,
    ]);
    return core;
  });
  return loading;
}
