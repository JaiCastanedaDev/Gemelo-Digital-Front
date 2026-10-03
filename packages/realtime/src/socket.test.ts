import { describe, expect, it } from 'vitest';
import { socketOptions } from './socket';

describe('socketOptions', () => {
  it('prueba websocket y cae a polling, sin conectar solo', () => {
    const options = socketOptions(() => 'tok', '/socket.io');
    expect(options.tryAllTransports).toBe(true);
    expect(options.autoConnect).toBe(false);
    expect(options.transports).toEqual(['websocket', 'polling']);
    expect(options.path).toBe('/socket.io');
  });

  it('envía el token vigente en cada (re)conexión', () => {
    let token: string | null = 'uno';
    const options = socketOptions(() => token, '/socket.io');
    const auth = options.auth;
    if (typeof auth !== 'function') throw new Error('auth debe ser una función');
    const seen: unknown[] = [];
    auth((data) => seen.push(data));
    token = 'dos';
    auth((data) => seen.push(data));
    expect(seen).toEqual([{ token: 'uno' }, { token: 'dos' }]);
  });
});
