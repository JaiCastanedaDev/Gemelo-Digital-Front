import { downsampleSeries, type DownsampleStrategy, type SeriesMap } from '@gd/domain';

export interface DownsampleRequest {
  id: number;
  series: SeriesMap;
  strategy: DownsampleStrategy;
  target: number;
}

export interface DownsampleResponse {
  id: number;
  series: SeriesMap;
}

export function handleDownsample(request: DownsampleRequest): DownsampleResponse {
  return { id: request.id, series: downsampleSeries(request.series, request.strategy, request.target) };
}
