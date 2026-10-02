import { describe, expect, it } from 'vitest';
import { OFFLINE_BANNER_DELAY_MS, connectionKind, shouldShowOfflineBanner } from './connectionState';

describe('connectionKind', () => {
  it('sin red o con el socket caído es offline', () => {
    expect(connectionKind(false, 'connected')).toBe('offline');
    expect(connectionKind(true, 'disconnected')).toBe('offline');
  });
  it('solo "connected" es en vivo; el resto está conectando', () => {
    expect(connectionKind(true, 'connected')).toBe('live');
    expect(connectionKind(true, 'reconnecting')).toBe('connecting');
    expect(connectionKind(true, 'connecting')).toBe('connecting');
    expect(connectionKind(true, 'idle')).toBe('connecting');
  });
});

describe('shouldShowOfflineBanner', () => {
  const now = 100_000;
  it('sin red se muestra de inmediato', () => {
    expect(shouldShowOfflineBanner({ online: false, kind: 'offline', notLiveSince: now, now })).toBe(true);
  });
  it('en vivo nunca se muestra', () => {
    expect(shouldShowOfflineBanner({ online: true, kind: 'live', notLiveSince: null, now })).toBe(false);
  });
  it('una reconexión breve (rotación de token) no lo muestra', () => {
    expect(shouldShowOfflineBanner({ online: true, kind: 'connecting', notLiveSince: now - 2_000, now })).toBe(false);
  });
  it('tras 5 s sin socket se muestra', () => {
    expect(
      shouldShowOfflineBanner({ online: true, kind: 'offline', notLiveSince: now - OFFLINE_BANNER_DELAY_MS, now }),
    ).toBe(true);
  });
});
