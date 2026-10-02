import { MemoryTokenStore, sessionUserSchema, type SessionUser, type TokenStore } from '@gd/api';

const REFRESH_KEY = 'gd.refresh_token';
const USER_KEY = 'gd.user';

export function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** sessionStorage con respaldo en memoria si el navegador lo bloquea o lanza. */
export class SessionStorageTokenStore implements TokenStore {
  private readonly memory = new MemoryTokenStore();
  private storage: Storage | null;

  constructor(storage: Storage | null) {
    this.storage = storage;
  }

  private attempt<T>(operation: (storage: Storage) => T, fallback: () => T): T {
    if (!this.storage) return fallback();
    try {
      return operation(this.storage);
    } catch {
      this.storage = null;
      return fallback();
    }
  }

  getRefreshToken(): string | null {
    return this.attempt(
      (s) => s.getItem(REFRESH_KEY),
      () => this.memory.getRefreshToken(),
    );
  }

  setRefreshToken(token: string | null): void {
    this.memory.setRefreshToken(token);
    this.attempt(
      (s) => (token === null ? s.removeItem(REFRESH_KEY) : s.setItem(REFRESH_KEY, token)),
      () => undefined,
    );
  }

  getUser(): SessionUser | null {
    return this.attempt(
      (s) => {
        const raw = s.getItem(USER_KEY);
        if (!raw) return null;
        try {
          const parsed = sessionUserSchema.safeParse(JSON.parse(raw));
          return parsed.success ? parsed.data : null;
        } catch {
          return null;
        }
      },
      () => this.memory.getUser(),
    );
  }

  setUser(user: SessionUser | null): void {
    this.memory.setUser(user);
    this.attempt(
      (s) => (user === null ? s.removeItem(USER_KEY) : s.setItem(USER_KEY, JSON.stringify(user))),
      () => undefined,
    );
  }
}
