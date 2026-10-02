import type { RealtimeStatus } from '@gd/realtime';

export type ConnectionKind = 'live' | 'connecting' | 'offline';

export function connectionKind(online: boolean, status: RealtimeStatus): ConnectionKind {
  if (!online || status === 'disconnected') return 'offline';
  if (status === 'connected') return 'live';
  return 'connecting';
}

/** Evita mostrar el banner por reconexiones breves (p. ej. al rotar el token). */
export const OFFLINE_BANNER_DELAY_MS = 5_000;

export function shouldShowOfflineBanner(input: {
  online: boolean;
  kind: ConnectionKind;
  notLiveSince: number | null;
  now: number;
  delayMs?: number;
}): boolean {
  if (!input.online) return true;
  if (input.kind === 'live' || input.notLiveSince === null) return false;
  return input.now - input.notLiveSince >= (input.delayMs ?? OFFLINE_BANNER_DELAY_MS);
}
