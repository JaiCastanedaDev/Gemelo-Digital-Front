import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { MemoryTokenStore, createSessionManager, refreshDelayMs, type Scheduler } from './session';
import { makeFakeJwt } from './testing';

class FakeScheduler implements Scheduler {
  tasks: { id: number; fn: () => void; ms: number }[] = [];
  private nextId = 1;
  setTimeout(fn: () => void, ms: number) {
    const id = this.nextId++;
    this.tasks.push({ id, fn, ms });
    return id;
  }
  clearTimeout(handle: unknown) {
    this.tasks = this.tasks.filter((t) => t.id !== handle);
  }
  runAll() {
    const pending = this.tasks;
    this.tasks = [];
    pending.forEach((t) => t.fn());
  }
}

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function tokens(n: number, sub = 'usr-1', expiresIn = 900) {
  return {
    access_token: makeFakeJwt({ sub, role: 'ADMIN', buildingId: 'bld-1', n }),
    refresh_token: `r-${n}`,
    token_type: 'Bearer',
    expires_in: expiresIn,
  };
}
const user = { id: 'usr-1', email: 'admin@demo.co', name: 'Admin', role: 'ADMIN' as const };

function setup(handler: (url: string, body: Record<string, unknown>) => Response | Promise<Response>) {
  const store = new MemoryTokenStore();
  const scheduler = new FakeScheduler();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>),
  );
  const manager = createSessionManager({
    baseUrl: 'http://api.test',
    store,
    scheduler,
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { manager, store, scheduler, fetchMock };
}

describe('refreshDelayMs', () => {
  it('renueva 120 s antes de expirar', () => {
    expect(refreshDelayMs(900)).toBe(780_000);
  });
  it('con tokens muy cortos usa la mitad de la vida (sin bucle inmediato)', () => {
    expect(refreshDelayMs(60)).toBe(30_000);
    expect(refreshDelayMs(5)).toBe(2_500);
  });
  it('limita el retraso al máximo de setTimeout (2^31 - 1 ms)', () => {
    expect(refreshDelayMs(3_000_000)).toBe(2_147_483_647);
  });
});

describe('createSessionManager', () => {
  it('login guarda refresh y usuario, decodifica claims y programa el refresh', async () => {
    const { manager, store, scheduler } = setup(() => json(200, { ...tokens(1), user }));
    const session = await manager.login('admin@demo.co', 'x');
    expect(session.claims).toEqual({ sub: 'usr-1', role: 'ADMIN', buildingId: 'bld-1' });
    expect(manager.getAccessToken()).toBe(session.accessToken);
    expect(store.getRefreshToken()).toBe('r-1');
    expect(store.getUser()?.email).toBe('admin@demo.co');
    expect(scheduler.tasks.map((t) => t.ms)).toEqual([780_000]);
  });

  it('login fallido lanza ApiError con el código del backend', async () => {
    const { manager } = setup(() => json(423, { error: { code: 'ACCOUNT_LOCKED', message: 'bloqueada' } }));
    const err = await manager.login('a@b.co', 'x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 423, code: 'ACCOUNT_LOCKED' });
  });

  it('refresh es de vuelo único: dos llamadas simultáneas hacen un solo POST', async () => {
    let n = 1;
    const { manager, store, fetchMock } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : json(200, tokens(++n)),
    );
    await manager.login('admin@demo.co', 'x');
    const [a, b] = await Promise.all([manager.refresh(), manager.refresh()]);
    expect(a && b).toBe(true);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(1);
    expect(store.getRefreshToken()).toBe('r-2');
  });

  it('refresh rechazado cierra la sesión con motivo "expired"', async () => {
    const { manager, store } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : json(401, { error: { code: 'X', message: 'x' } }),
    );
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    await expect(manager.refresh()).resolves.toBe(false);
    expect(manager.getSession()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null, 'expired');
  });

  it('un fallo de red en el refresh conserva la sesión', async () => {
    const { manager } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      throw new TypeError('Failed to fetch');
    });
    await manager.login('admin@demo.co', 'x');
    await expect(manager.refresh()).resolves.toBe(false);
    expect(manager.getSession()).not.toBeNull();
  });

  it('restore usa el refresh guardado y el usuario almacenado', async () => {
    const { manager, store } = setup(() => json(200, tokens(5)));
    store.setRefreshToken('r-guardado');
    store.setUser(user);
    const session = await manager.restore();
    expect(session?.claims.sub).toBe('usr-1');
    expect(session?.user?.name).toBe('Admin');
  });

  it('restore sin refresh guardado no llama al backend; después funciona con token', async () => {
    const { manager, store, fetchMock } = setup(() => json(200, tokens(7)));
    await expect(manager.restore()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    store.setRefreshToken('r-nuevo');
    await expect(manager.restore()).resolves.not.toBeNull();
  });

  it('el timer programado dispara el refresh', async () => {
    let n = 1;
    const { manager, scheduler, store } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : json(200, tokens(++n)),
    );
    await manager.login('admin@demo.co', 'x');
    scheduler.runAll();
    await vi.waitFor(() => expect(store.getRefreshToken()).toBe('r-2'));
  });

  it('logout limpia todo, avisa "logout" y tolera fallos del backend', async () => {
    const { manager, store, fetchMock } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      throw new TypeError('Failed to fetch');
    });
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    await manager.logout();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getUser()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null, 'logout');
    const logoutCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/auth/logout'));
    expect(JSON.parse(String(logoutCall?.[1]?.body))).toEqual({ refresh_token: 'r-1' });
  });

  describe('waitForReauth', () => {
    /** Inicia sesión como usr-1, hace expirar la sesión y deja preparado el próximo login como `nextLoginSub`. */
    async function expiredManager(nextLoginSub: string) {
      let loginSub = 'usr-1';
      let n = 0;
      const { manager } = setup((url) => {
        if (url.endsWith('/auth/refresh')) return json(401, { error: { code: 'X', message: 'x' } });
        return json(200, { ...tokens(++n, loginSub), user });
      });
      await manager.login('admin@demo.co', 'x');
      await manager.refresh();
      loginSub = nextLoginSub;
      return manager;
    }

    it('resuelve true cuando el mismo usuario vuelve a entrar', async () => {
      const manager = await expiredManager('usr-1');
      const waiting = manager.waitForReauth();
      await manager.login('admin@demo.co', 'x');
      await expect(waiting).resolves.toBe(true);
    });

    it('resuelve false si entra otro usuario', async () => {
      const manager = await expiredManager('usr-2');
      const waiting = manager.waitForReauth();
      await manager.login('otro@demo.co', 'x');
      await expect(waiting).resolves.toBe(false);
    });

    it('resuelve false de inmediato si no hay una sesión expirada', async () => {
      const { manager } = setup(() => json(500, {}));
      await expect(manager.waitForReauth()).resolves.toBe(false);
    });
  });
});

describe('respuestas tardías (carreras con logout y cambio de usuario)', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('un refresh en vuelo que responde 200 después de logout no revive la sesión', async () => {
    const lateRefresh = deferred<Response>();
    const { manager, store, scheduler } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      if (url.endsWith('/auth/refresh')) return lateRefresh.promise;
      return json(200, {});
    });
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    const refreshing = manager.refresh();
    await manager.logout();
    lateRefresh.resolve(json(200, tokens(2)));
    await expect(refreshing).resolves.toBe(false);
    expect(manager.getSession()).toBeNull();
    expect(manager.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getUser()).toBeNull();
    expect(scheduler.tasks).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(null, 'logout');
  });

  it('un login en vuelo que responde después de logout no abre la sesión', async () => {
    const lateLogin = deferred<Response>();
    const { manager, store, scheduler } = setup((url) => (url.endsWith('/auth/login') ? lateLogin.promise : json(200, {})));
    const logging = manager.login('admin@demo.co', 'x');
    const outcome = logging.catch((e: unknown) => e);
    await manager.logout();
    lateLogin.resolve(json(200, { ...tokens(1), user }));
    await expect(outcome).resolves.toBeInstanceOf(Error);
    expect(manager.getSession()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getUser()).toBeNull();
    expect(scheduler.tasks).toHaveLength(0);
  });

  it('el refresh tardío del usuario A no pisa la sesión del usuario B que entró entretanto', async () => {
    const lateRefresh = deferred<Response>();
    let loginSub = 'usr-1';
    let n = 0;
    const { manager, store } = setup((url) => {
      if (url.endsWith('/auth/refresh')) return lateRefresh.promise;
      return json(200, { ...tokens(++n, loginSub), user });
    });
    await manager.login('admin@demo.co', 'x');
    const refreshing = manager.refresh();
    loginSub = 'usr-2';
    await manager.login('otro@demo.co', 'x');
    const refreshTokenOfB = store.getRefreshToken();
    lateRefresh.resolve(json(200, tokens(99, 'usr-1')));
    await expect(refreshing).resolves.toBe(false);
    expect(manager.getSession()?.claims.sub).toBe('usr-2');
    expect(store.getRefreshToken()).toBe(refreshTokenOfB);
    expect(refreshTokenOfB).toBe('r-2');
  });

  it('un 401 tardío después de logout no emite "expired"', async () => {
    const lateRefresh = deferred<Response>();
    const { manager } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      if (url.endsWith('/auth/refresh')) return lateRefresh.promise;
      return json(200, {});
    });
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    const refreshing = manager.refresh();
    await manager.logout();
    lateRefresh.resolve(json(401, { error: { code: 'X', message: 'x' } }));
    await expect(refreshing).resolves.toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(null, 'logout');
    await expect(manager.waitForReauth()).resolves.toBe(false);
  });
});

describe('respuestas de refresh malformadas', () => {
  const malformed: [string, () => Response][] = [
    ['200 que no es JSON', () => new Response('<html>oops</html>', { status: 200 })],
    ['200 JSON sin refresh_token ni token_type', () => json(200, { access_token: tokens(2).access_token, expires_in: 900 })],
    ['200 con un access_token que no es un JWT', () => json(200, { ...tokens(2), access_token: 'no-es-un-jwt' })],
  ];

  async function withUnhandledRejections(run: () => Promise<void>) {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await run();
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    return seen;
  }

  it.each(malformed)('refresh con %s resuelve false y cierra la sesión como "expired"', async (_name, bad) => {
    const { manager, store } = setup((url) => (url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : bad()));
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    await expect(manager.refresh()).resolves.toBe(false);
    expect(manager.getSession()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(store.getUser()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null, 'expired');
  });

  it.each(malformed)('restore con %s resuelve null y limpia el refresh guardado', async (_name, bad) => {
    const { manager, store } = setup(() => bad());
    store.setRefreshToken('r-guardado');
    store.setUser(user);
    await expect(manager.restore()).resolves.toBeNull();
    expect(store.getRefreshToken()).toBeNull();
  });

  it('el refresh disparado por el timer no produce rechazos sin manejar', async () => {
    const { manager, scheduler } = setup((url) =>
      url.endsWith('/auth/login') ? json(200, { ...tokens(1), user }) : new Response('no json', { status: 200 }),
    );
    await manager.login('admin@demo.co', 'x');
    const seen = await withUnhandledRejections(async () => {
      scheduler.runAll();
      await vi.waitFor(() => expect(manager.getSession()).toBeNull());
    });
    expect(seen).toEqual([]);
  });

  it('una respuesta malformada que llega tras un logout no emite "expired"', async () => {
    let release!: (response: Response) => void;
    const late = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { manager } = setup((url) => {
      if (url.endsWith('/auth/login')) return json(200, { ...tokens(1), user });
      if (url.endsWith('/auth/refresh')) return late;
      return json(200, {});
    });
    await manager.login('admin@demo.co', 'x');
    const listener = vi.fn();
    manager.subscribe(listener);
    const refreshing = manager.refresh();
    await manager.logout();
    release(new Response('no json', { status: 200 }));
    await expect(refreshing).resolves.toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(null, 'logout');
  });

  it('con expires_in enorme no refresca de inmediato y programa el máximo permitido', async () => {
    const { manager, scheduler, fetchMock } = setup(() => json(200, { ...tokens(1, 'usr-1', 3_000_000), user }));
    await manager.login('admin@demo.co', 'x');
    expect(scheduler.tasks.map((t) => t.ms)).toEqual([2_147_483_647]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(0);
  });
});
