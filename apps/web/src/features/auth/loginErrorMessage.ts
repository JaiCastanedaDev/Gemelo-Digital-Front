import { ApiError } from '@gd/api';

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 423 || error.code === 'ACCOUNT_LOCKED') {
      return 'Tu cuenta está bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en 15 minutos.';
    }
    if (error.status === 401) return 'Correo o contraseña incorrectos.';
    if (error.status === 429) return 'Demasiados intentos. Espera unos segundos e inténtalo de nuevo.';
    if (error.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }
  return 'No pudimos iniciar sesión. Intenta de nuevo.';
}
