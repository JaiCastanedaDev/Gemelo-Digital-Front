import { ApiError, ContractDriftError } from '@gd/api';
import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';

const apiError = (status: number) => new ApiError({ status, code: `HTTP_${status}`, message: 'del servidor' });

describe('errorMessage', () => {
  it('traduce los casos conocidos', () => {
    expect(errorMessage(apiError(0))).toMatch(/No se pudo conectar/);
    expect(errorMessage(apiError(403))).toMatch(/No tienes permiso/);
    expect(errorMessage(apiError(404))).toMatch(/No encontramos/);
    expect(errorMessage(apiError(429))).toMatch(/Demasiadas solicitudes/);
    expect(errorMessage(apiError(503))).toMatch(/El servidor tuvo un problema/);
    expect(errorMessage(new ContractDriftError({ method: 'GET', path: '/x', issues: [] }))).toMatch(/formato inesperado/);
  });
  it('usa el mensaje del backend para otros códigos y uno genérico para lo desconocido', () => {
    expect(errorMessage(apiError(409))).toBe('del servidor');
    expect(errorMessage('???')).toMatch(/Ocurrió un error inesperado/);
  });
});
