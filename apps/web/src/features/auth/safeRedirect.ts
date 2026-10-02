/** Evita redirecciones abiertas: solo rutas internas que empiezan por una sola "/". */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/')) return '/';
  if (target.startsWith('//') || target.startsWith('/\\')) return '/';
  if (target === '/login' || target.startsWith('/login?')) return '/';
  return target;
}
