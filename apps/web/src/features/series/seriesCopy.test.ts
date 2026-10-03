import { describe, expect, it } from 'vitest';
import { formatChange, seriesLabel } from './seriesCopy';

describe('formatChange', () => {
  it('decide el signo tras redondear a 2 decimales', () => {
    expect(formatChange(-0.001, 'mm')).toBe('0 mm');
    expect(formatChange(0.004, 'mm')).toBe('0 mm');
    expect(formatChange(0, 'mm')).toBe('0 mm');
    expect(formatChange(0.3, 'mm')).toBe('+0,3 mm');
    expect(formatChange(-0.256, 'mm')).toBe('−0,26 mm');
    expect(formatChange(1, null)).toBe('+1');
  });
  it('seriesLabel traduce claves conocidas', () => {
    expect(seriesLabel('x')).toBe('Eje X');
    expect(seriesLabel('otro')).toBe('otro');
  });
});
