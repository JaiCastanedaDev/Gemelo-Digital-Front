import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safeRedirect';

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/aire')).toBe('/aire');
    expect(safeRedirect('/alertas?nivel=CRITICAL')).toBe('/alertas?nivel=CRITICAL');
  });
  it.each([null, '', '//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/login'])(
    'rechaza %s y vuelve al inicio',
    (target) => {
      expect(safeRedirect(target)).toBe('/');
    },
  );
});
