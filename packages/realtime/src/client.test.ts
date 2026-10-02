import type { Scheduler } from '@gd/api';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_RETRY_DELAYS_MS, createRealtimeClient, type RealtimeStatus } from './client';
import type { SocketLike, SocketListener } from './socket';

class FakeSocket implements SocketLike {
  connected = false;
  active = false;
  disconnectCalls = 0;
  tokensSent: (string | null)[] = [];
  private readonly getToken: () => string | null;
  private readonly listeners = new Map<string, Set<SocketListener>>();

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
  }
  connect() {
    this.active = true;
    this.tokensSent.push(this.getToken());
  }
  disconnect() {
    this.disconnectCalls++;
    const wasConnected = this.connected;
    this.connected = false;
    this.active = false;
    if (wasConnected) this.emit('disconnect', 'io client disconnect');
  }
  on(event: string, listener: SocketListener) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }
  off(event: string, listener: SocketListener) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
  }
  serverAccepts() {
    this.connected = true;
    this.emit('connect');
  }
  serverRejects() {
    this.connected = false;
    this.active = false;
    this.emit('connect_error', new Error('unauthorized'));
  }
  transportDrops() {
    this.connected = false;
    this.active = true;
    this.emit('disconnect', 'transport close');
  }
}

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

const adminPayload = {
  alert_id: 'alrt-20261002-00009',
  building_id: 'bld-1',
  sensor_id: 'acc-t1-sotano',
  level: 'CRITICAL',
  category: 'structural',
  message: 'Aceleración superior al umbral configurado',
  timestamp: '2026-10-02T15:00:00Z',
  acknowledged: false,
  value_triggered: 0.41,
  threshold_configured: 0.2,
  occurrence_count: 1,
  acknowledged_by: null,
  acknowledged_at: null,
};

function setup(options: { role?: 'ADMIN' | 'RESIDENTE'; token?: string | null; refresh?: () => Promise<boolean> } = {}) {
  const state = { token: options.token === undefined ? 't1' : options.token };
  const sockets: FakeSocket[] = [];
  const scheduler = new FakeScheduler();
  const statuses: RealtimeStatus[] = [];
  const onInvalidPayload = vi.fn();
  const refreshAccessToken = vi.fn(
    options.refresh ??
      (async () => {
        state.token = 't2';
        return true;
      }),
  );
  const client = createRealtimeClient({
    url: 'http://api.test',
    role: options.role ?? 'ADMIN',
    getAccessToken: () => state.token,
    refreshAccessToken,
    scheduler,
    onInvalidPayload,
    socketFactory: ({ getToken }) => {
      const socket = new FakeSocket(getToken);
      sockets.push(socket);
      return socket;
    },
  });
  client.onStatus((s) => statuses.push(s));
  const socket = () => {
    const s = sockets[0];
    if (!s) throw new Error('no se creó el socket');
    return s;
  };
  return { client, state, sockets, socket, scheduler, statuses, onInvalidPayload, refreshAccessToken };
}

describe('createRealtimeClient', () => {
  it('sin token no crea socket y queda desconectado', () => {
    const { client, sockets } = setup({ token: null });
    client.start();
    expect(sockets).toHaveLength(0);
    expect(client.getStatus()).toBe('disconnected');
  });

  it('conecta enviando el token en el handshake', () => {
    const { client, socket, statuses } = setup();
    client.start();
    expect(socket().tokensSent).toEqual(['t1']);
    socket().serverAccepts();
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('valida alert:new con el schema del rol de administrador', () => {
    const { client, socket } = setup();
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().serverAccepts();
    socket().emit('alert:new', adminPayload);
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ alert_id: adminPayload.alert_id, occurrence_count: 1 }));
  });

  it('al residente nunca le entrega campos numéricos aunque el servidor los mande', () => {
    const { client, socket } = setup({ role: 'RESIDENTE' });
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().emit('alert:new', adminPayload);
    const alert = received.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(alert).not.toHaveProperty('value_triggered');
    expect(alert).not.toHaveProperty('threshold_configured');
    expect(alert).not.toHaveProperty('occurrence_count');
  });

  it('descarta y reporta un payload fuera de contrato', () => {
    const { client, socket, onInvalidPayload } = setup();
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().emit('alert:new', { alert_id: 1, level: 'PANICO' });
    expect(received).not.toHaveBeenCalled();
    expect(onInvalidPayload).toHaveBeenCalledTimes(1);
  });

  it('una caída de transporte pasa a reconnecting sin reintento manual', () => {
    const { client, socket, scheduler } = setup();
    client.start();
    socket().serverAccepts();
    socket().transportDrops();
    expect(client.getStatus()).toBe('reconnecting');
    expect(scheduler.tasks).toHaveLength(0);
    socket().serverAccepts();
    expect(client.getStatus()).toBe('connected');
  });

  it('si el servidor rechaza el handshake renueva el token y reintenta', async () => {
    const { client, socket, scheduler, refreshAccessToken } = setup();
    client.start();
    socket().serverRejects();
    expect(client.getStatus()).toBe('reconnecting');
    expect(scheduler.tasks[0]?.ms).toBe(AUTH_RETRY_DELAYS_MS[0]);
    scheduler.runAll();
    await vi.waitFor(() => expect(socket().tokensSent).toEqual(['t1', 't2']));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras agotar los reintentos y queda desconectado', async () => {
    const { client, socket, scheduler } = setup();
    client.start();
    for (let attempt = 0; attempt < AUTH_RETRY_DELAYS_MS.length; attempt++) {
      socket().serverRejects();
      scheduler.runAll();
      await vi.waitFor(() => expect(socket().tokensSent).toHaveLength(attempt + 2));
    }
    socket().serverRejects();
    expect(client.getStatus()).toBe('disconnected');
    expect(scheduler.tasks).toHaveLength(0);
  });

  it('si el refresh falla y no queda token, queda desconectado', async () => {
    const { client, socket, scheduler, state } = setup({
      refresh: async () => {
        state.token = null;
        return false;
      },
    });
    client.start();
    socket().serverRejects();
    scheduler.runAll();
    await vi.waitFor(() => expect(client.getStatus()).toBe('disconnected'));
    expect(socket().tokensSent).toEqual(['t1']);
  });

  it('tokenChanged reconecta con el token nuevo sin pasar por disconnected', () => {
    const { client, socket, statuses, state } = setup();
    client.start();
    socket().serverAccepts();
    state.token = 't9';
    client.tokenChanged();
    expect(socket().tokensSent).toEqual(['t1', 't9']);
    expect(statuses).not.toContain('disconnected');
    socket().serverAccepts();
    expect(client.getStatus()).toBe('connected');
  });

  it('stop desconecta, limpia reintentos e ignora eventos posteriores', () => {
    const { client, socket, scheduler } = setup();
    const received = vi.fn();
    client.onAlert(received);
    client.start();
    socket().serverRejects();
    client.stop();
    expect(scheduler.tasks).toHaveLength(0);
    expect(client.getStatus()).toBe('idle');
    socket().emit('alert:new', adminPayload);
    expect(received).not.toHaveBeenCalled();
  });
});
