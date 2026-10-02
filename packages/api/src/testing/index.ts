import { decodeJwtPayload } from '../jwt';

function base64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** JWT sin firma válida, solo para mocks y tests. */
export function makeFakeJwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.firma-de-prueba`;
}

export function readFakeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = decodeJwtPayload(token);
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
