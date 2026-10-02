import { describe, expect, it } from 'vitest';
import { SessionStorageTokenStore } from './SessionStorageTokenStore';

const user = { id: 'usr-1', email: 'admin@demo.co', name: 'Admin', role: 'ADMIN' as const };

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('bloqueado', 'SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail, clear: fail, key: fail, length: 0 } as unknown as Storage;
}

describe('SessionStorageTokenStore', () => {
  it('persiste refresh y usuario en sessionStorage', () => {
    const store = new SessionStorageTokenStore(window.sessionStorage);
    store.setRefreshToken('r-1');
    store.setUser(user);
    const other = new SessionStorageTokenStore(window.sessionStorage);
    expect(other.getRefreshToken()).toBe('r-1');
    expect(other.getUser()?.email).toBe('admin@demo.co');
  });

  it('si el storage lanza, sigue funcionando en memoria', () => {
    const store = new SessionStorageTokenStore(throwingStorage());
    store.setRefreshToken('r-1');
    store.setUser(user);
    expect(store.getRefreshToken()).toBe('r-1');
    expect(store.getUser()?.name).toBe('Admin');
  });

  it('sin storage disponible (null) funciona en memoria', () => {
    const store = new SessionStorageTokenStore(null);
    store.setRefreshToken('r-1');
    expect(store.getRefreshToken()).toBe('r-1');
  });

  it('ignora un usuario corrupto', () => {
    window.sessionStorage.setItem('gd.user', '{no-json');
    expect(new SessionStorageTokenStore(window.sessionStorage).getUser()).toBeNull();
  });
});
