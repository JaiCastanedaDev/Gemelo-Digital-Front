import { ApiError, ContractDriftError } from '@gd/api';

const GENERIC = 'Ocurrió un error inesperado. Intenta de nuevo.';

export function errorMessage(error: unknown): string {
  if (error instanceof ContractDriftError) {
    return 'Recibimos datos con un formato inesperado. Intenta de nuevo más tarde.';
  }
  if (error instanceof ApiError) {
    if (error.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    if (error.status === 401) return 'Tu sesión expiró. Vuelve a ingresar.';
    if (error.status === 403) return 'No tienes permiso para ver esta información.';
    if (error.status === 404) return 'No encontramos esta información.';
    if (error.status === 429) return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
    if (error.status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.';
    return error.message || GENERIC;
  }
  return GENERIC;
}
