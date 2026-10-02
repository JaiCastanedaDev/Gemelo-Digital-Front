const BASE = 'http://placeholder.invalid';
/** Caracteres de control, espacio y DEL, más la barra invertida: el parser de URL los elimina o reinterpreta. */
function hasUnsafeChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || char === '\\') return true;
  }
  return false;
}

/**
 * Evita redirecciones abiertas: solo rutas internas que empiezan por una sola "/".
 * Devuelve siempre una ruta normalizada (pathname + search + hash) del mismo origen.
 */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/';
  if (hasUnsafeChars(target)) return '/';
  let resolved: URL;
  try {
    resolved = new URL(target, BASE);
  } catch {
    return '/';
  }
  if (resolved.origin !== new URL(BASE).origin) return '/';
  if (resolved.pathname === '/login' || resolved.pathname.startsWith('/login/')) return '/';
  return resolved.pathname + resolved.search + resolved.hash;
}
