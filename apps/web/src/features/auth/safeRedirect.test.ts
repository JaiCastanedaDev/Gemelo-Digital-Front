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

  it.each(['/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/ /evil.com', '/\u0000/evil.com', '/a\\b'])(
    'rechaza caracteres de control, espacios o barras invertidas incrustados: %j',
    (target) => {
      expect(safeRedirect(target)).toBe('/');
    },
  );

  it.each(['/login/', '/login#x', '/login/foo', '/login?volver=%2Faire', '/./login', '/aire/../login'])(
    'rechaza la familia /login: %s',
    (target) => {
      expect(safeRedirect(target)).toBe('/');
    },
  );

  it('conserva rutas internas válidas con consulta y hash', () => {
    expect(safeRedirect('/aire')).toBe('/aire');
    expect(safeRedirect('/alertas?nivel=CRITICAL&acusada=false')).toBe('/alertas?nivel=CRITICAL&acusada=false');
    expect(safeRedirect('/gemelo?sensor=abc#x')).toBe('/gemelo?sensor=abc#x');
    expect(safeRedirect('/loginx')).toBe('/loginx');
  });

  it('un %09 codificado solo produce una ruta interna normalizada, nunca otro origen', () => {
    const result = safeRedirect('/%09/evil.com');
    expect(result).toBe('/%09/evil.com');
    expect(new URL(result, 'http://localhost:5173').origin).toBe('http://localhost:5173');
  });
});
