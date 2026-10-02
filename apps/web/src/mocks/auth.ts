import type { Role } from '@gd/api';
import { makeFakeJwt, readFakeJwt } from '@gd/api/testing';
import { HttpResponse } from 'msw';
import { db } from './db';
import type { MockUser } from './seed';

export interface MockClaims {
  sub: string;
  role: Role;
  buildingId: string;
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: unknown = null,
  headers: Record<string, string> = {},
) {
  return HttpResponse.json({ error: { code, message, details } }, { status, headers });
}

/** Tokens sin estado (sobreviven a recargar la página); la invalidación usa `iat_ms`. */
export function issueTokens(user: MockUser) {
  const nowMs = Date.now();
  const iat = Math.floor(nowMs / 1000);
  const accessToken = makeFakeJwt({
    sub: user.id,
    role: user.role,
    buildingId: user.buildingId,
    iat,
    exp: iat + db.settings.accessTtlSeconds,
    iat_ms: nowMs,
  });
  const refreshToken = makeFakeJwt({
    sub: user.id,
    typ: 'refresh',
    jti: crypto.randomUUID(),
    exp: iat + db.settings.refreshTtlSeconds,
    iat_ms: nowMs,
  });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: db.settings.accessTtlSeconds,
  };
}

export function authenticate(request: Request): MockClaims | Response {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? readFakeJwt(token) : null;
  if (!payload || payload.typ === 'refresh') return errorResponse(401, 'UNAUTHORIZED', 'Se requiere autenticación');
  const expired = !(Number(payload.exp) * 1000 > Date.now());
  const revoked = !(Number(payload.iat_ms) >= db.settings.accessValidAfterMs);
  if (expired || revoked) return errorResponse(401, 'TOKEN_EXPIRED', 'El token expiró');
  return { sub: String(payload.sub), role: payload.role as Role, buildingId: String(payload.buildingId) };
}

export function requireRole(claims: MockClaims, roles: Role[]): Response | null {
  return roles.includes(claims.role) ? null : errorResponse(403, 'FORBIDDEN', 'No tienes permiso para este recurso');
}

/** Valida y consume un refresh token (rotación: cada uno sirve una sola vez). */
export function consumeRefreshToken(token: string): MockUser | null {
  const payload = readFakeJwt(token);
  if (!payload || payload.typ !== 'refresh') return null;
  const jti = String(payload.jti);
  if (db.usedRefreshTokens.has(jti)) return null;
  if (!(Number(payload.exp) * 1000 > Date.now())) return null;
  if (!(Number(payload.iat_ms) >= db.settings.refreshValidAfterMs)) return null;
  db.usedRefreshTokens.add(jti);
  return db.users.find((u) => u.id === payload.sub) ?? null;
}
