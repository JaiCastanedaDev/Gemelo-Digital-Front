import { useState } from 'react';
import styles from './DevPanel.module.css';
import { emitMockAlert } from './emit';
import { realtimeBus } from './realtimeBus';

const DEV_KEY = 'gd.mock.dev';

/** `?dev=1` activa el panel y se recuerda en la pestaña. */
export function isDevPanelRequested(): boolean {
  const fromUrl = new URLSearchParams(window.location.search).get('dev') === '1';
  try {
    if (fromUrl) window.sessionStorage.setItem(DEV_KEY, '1');
    return fromUrl || window.sessionStorage.getItem(DEV_KEY) === '1';
  } catch {
    return fromUrl;
  }
}

export function DevPanel() {
  const [connected, setConnected] = useState(realtimeBus.getStatus() === 'connected');
  return (
    <aside className={styles.panel} aria-label="Panel de simulación">
      <strong>Simulación (solo desarrollo)</strong>
      <button type="button" onClick={() => emitMockAlert({ level: 'CRITICAL' })}>
        Simular alerta crítica
      </button>
      <button type="button" onClick={() => emitMockAlert({ level: 'WARNING' })}>
        Simular advertencia
      </button>
      <button
        type="button"
        onClick={() => {
          realtimeBus.setStatus(connected ? 'disconnected' : 'connected');
          setConnected(!connected);
        }}
      >
        {connected ? 'Cortar tiempo real' : 'Restablecer tiempo real'}
      </button>
    </aside>
  );
}
