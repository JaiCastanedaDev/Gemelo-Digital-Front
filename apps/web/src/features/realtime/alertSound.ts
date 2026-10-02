export type SoundResult = 'played' | 'blocked' | 'unsupported';

export interface AlertSound {
  play(): Promise<SoundResult>;
  /** Llamar desde un gesto del usuario (clic) para desbloquear el audio. */
  unlock(): Promise<boolean>;
}

type AudioContextCtor = new () => AudioContext;

/** Tiempo máximo que `play()` espera a que el navegador reanude el audio. */
export const RESUME_TIMEOUT_MS = 300;

function defaultCtor(): AudioContextCtor | undefined {
  return typeof window === 'undefined' ? undefined : window.AudioContext;
}

/** Dos tonos cortos generados con Web Audio: no requiere archivos y nunca lanza. */
export function createAlertSound(getContextCtor: () => AudioContextCtor | undefined = defaultCtor): AlertSound {
  let context: AudioContext | null = null;

  function getContext(): AudioContext | null {
    if (context) return context;
    const Ctor = getContextCtor();
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    return context;
  }

  // Función aparte para que TS no estreche `state` y vuelva a leerlo tras `resume()`.
  function isRunning(ctx: AudioContext): boolean {
    return ctx.state === 'running';
  }

  async function resume(ctx: AudioContext): Promise<boolean> {
    if (isRunning(ctx)) return true;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
    return isRunning(ctx);
  }

  function beep(ctx: AudioContext) {
    const start = ctx.currentTime;
    const tones: [number, number][] = [
      [0, 880],
      [0.25, 660],
    ];
    for (const [offset, frequency] of tones) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.22);
    }
  }

  /**
   * Chrome y Firefox no rechazan `resume()` cuando el autoplay está bloqueado: la promesa
   * queda pendiente hasta un gesto del usuario. Se compite contra un tiempo máximo y,
   * si vence, no se reproduce nada aunque `resume()` se resuelva más tarde.
   */
  async function resumeWithin(ctx: AudioContext, timeoutMs: number): Promise<boolean> {
    if (isRunning(ctx)) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    try {
      return await Promise.race([resume(ctx), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async play() {
      const ctx = getContext();
      if (!ctx) return 'unsupported';
      if (!(await resumeWithin(ctx, RESUME_TIMEOUT_MS))) return 'blocked';
      try {
        beep(ctx);
      } catch {
        return 'blocked';
      }
      return 'played';
    },
    async unlock() {
      const ctx = getContext();
      if (!ctx) return false;
      return resume(ctx);
    },
  };
}
