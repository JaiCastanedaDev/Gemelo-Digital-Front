import { describe, expect, it } from 'vitest';
import { describeVariation } from './consumption';

describe('describeVariation', () => {
  it('null o no finito: sin datos del periodo anterior, nunca 0 %', () => {
    expect(describeVariation(null)).toEqual({ text: 'Sin datos del periodo anterior', direction: null });
    expect(describeVariation(Number.NaN).direction).toBeNull();
  });
  it('subida y bajada con flecha y un decimal', () => {
    expect(describeVariation(12.24)).toEqual({ text: '↑ 12,2 % frente al mismo tramo del mes anterior', direction: 'up' });
    expect(describeVariation(-6.548)).toEqual({ text: '↓ 6,5 % frente al mismo tramo del mes anterior', direction: 'down' });
  });
  it('sin cambio', () => {
    expect(describeVariation(0.04)).toEqual({ text: 'Igual que el mismo tramo del mes anterior', direction: 'flat' });
  });
});
