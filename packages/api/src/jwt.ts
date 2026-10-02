/** Decodifica el payload de un JWT sin verificar la firma (la verificación es del backend). */
export function decodeJwtPayload(token: string): unknown {
  const part = token.split('.')[1];
  if (!part) throw new Error('JWT inválido');
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
