import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { useEffect, useRef } from 'react';
import styles from './Chart.module.css';
import { loadECharts } from './echartsLoader';

interface EChartProps {
  /** Memoizar con useMemo: cada cambio de identidad reaplica setOption(notMerge) y reinicia el zoom. */
  option: EChartsCoreOption;
  /** Descripción para lectores de pantalla; los datos están en la alternativa "Ver como tabla". */
  label: string;
  height?: number;
}

export function EChart({ option, label, height = 280 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void loadECharts().then((echarts) => {
      const container = containerRef.current;
      if (disposed || !container) return;
      const chart = echarts.init(container, undefined, { renderer: 'canvas' });
      chart.setOption(optionRef.current, { notMerge: true });
      chartRef.current = chart;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => chart.resize());
        observer.observe(container);
      }
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={containerRef} className={styles.chart} role="img" aria-label={label} style={{ height }} />;
}
