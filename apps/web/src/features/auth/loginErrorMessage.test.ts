import { ApiError } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './loginErrorMessage';

const err = (status: number, code = `HTTP_${status}`) => new ApiError({ status, code, message: 'x' });

describe('loginErrorMessage', () => {
  it('credenciales incorrectas → mensaje genérico (no revela si el correo existe)', () => {
    expect(loginErrorMessage(err(401))).toBe('Correo o contraseña incorrectos.');
  });
  it('cuenta bloqueada por 423 o por código', () => {
    expect(loginErrorMessage(err(423))).toMatch(/bloqueada temporalmente.*15 minutos/);
    expect(loginErrorMessage(err(403, 'ACCOUNT_LOCKED'))).toMatch(/bloqueada temporalmente/);
  });
  it('rate limit, red y otros', () => {
    expect(loginErrorMessage(err(429))).toMatch(/Demasiados intentos/);
    expect(loginErrorMessage(err(0))).toMatch(/No se pudo conectar/);
    expect(loginErrorMessage(err(500))).toBe('No pudimos iniciar sesión. Intenta de nuevo.');
  });
});
