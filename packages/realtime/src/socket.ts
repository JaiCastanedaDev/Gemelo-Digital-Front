import { io } from 'socket.io-client';

export type SocketListener = (...args: unknown[]) => void;

/** Lo mínimo de un socket de Socket.IO que usa el cliente (permite probarlo sin servidor). */
export interface SocketLike {
  readonly connected: boolean;
  /** true mientras socket.io seguirá intentando reconectar por su cuenta. */
  readonly active: boolean;
  connect(): void;
  disconnect(): void;
  on(event: string, listener: SocketListener): void;
  off(event: string, listener: SocketListener): void;
}

export interface SocketFactoryOptions {
  url: string;
  path: string;
  getToken: () => string | null;
}

export type SocketFactory = (options: SocketFactoryOptions) => SocketLike;

export const ioSocketFactory: SocketFactory = ({ url, path, getToken }) => {
  const socket = io(url, {
    path,
    autoConnect: false,
    transports: ['websocket', 'polling'],
    // Se evalúa en cada (re)conexión: siempre viaja el access token vigente.
    auth: (cb) => cb({ token: getToken() }),
  });
  return {
    get connected() {
      return socket.connected;
    },
    get active() {
      return socket.active;
    },
    connect: () => {
      socket.connect();
    },
    disconnect: () => {
      socket.disconnect();
    },
    on: (event, listener) => {
      socket.on(event, listener);
    },
    off: (event, listener) => {
      socket.off(event, listener);
    },
  };
};
