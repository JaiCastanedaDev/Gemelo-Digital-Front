import { HttpResponse, http } from 'msw';
import { consumeRefreshToken, errorResponse, issueTokens } from '../auth';
import { db } from '../db';
import { RATE_LIMITED_EMAIL } from '../seed';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

export const authHandlers = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = String(body.email ?? '').trim().toLowerCase();

    if (email === RATE_LIMITED_EMAIL) {
      return errorResponse(429, 'RATE_LIMITED', 'Demasiadas solicitudes', null, { 'Retry-After': '30' });
    }

    const attempts = db.loginAttempts.get(email) ?? { count: 0, lockedUntil: null };
    if (attempts.lockedUntil !== null && attempts.lockedUntil > Date.now()) {
      return errorResponse(423, 'ACCOUNT_LOCKED', 'Cuenta bloqueada temporalmente');
    }

    const user = db.users.find((u) => u.email === email);
    if (!user || user.password !== body.password) {
      attempts.count += 1;
      if (attempts.count >= MAX_ATTEMPTS) {
        db.loginAttempts.set(email, { count: 0, lockedUntil: Date.now() + LOCK_MS });
        return errorResponse(423, 'ACCOUNT_LOCKED', 'Cuenta bloqueada temporalmente');
      }
      db.loginAttempts.set(email, attempts);
      return errorResponse(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas');
    }

    db.loginAttempts.delete(email);
    return HttpResponse.json({
      ...issueTokens(user),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  }),

  http.post('*/api/v1/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refresh_token?: unknown };
    const user = consumeRefreshToken(String(body.refresh_token ?? ''));
    if (!user) return errorResponse(401, 'INVALID_REFRESH_TOKEN', 'Sesión expirada');
    return HttpResponse.json(issueTokens(user));
  }),

  http.post('*/api/v1/auth/logout', async ({ request }) => {
    const body = (await request.json()) as { refresh_token?: unknown };
    consumeRefreshToken(String(body.refresh_token ?? ''));
    return new HttpResponse(null, { status: 204 });
  }),
];
