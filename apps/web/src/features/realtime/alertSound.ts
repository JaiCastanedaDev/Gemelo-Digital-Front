export type SoundResult = 'played' | 'blocked' | 'unsupported';

export interface AlertSound {
  play(): Promise<SoundResult>;
  /** Llamar desde un gesto del usuario (clic) para desbloquear el audio. */
  unlock(): Promise<boolean>;
}

type AudioContextCtor = new () => AudioContext;

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

  return {
    async play() {
      const ctx = getContext();
      if (!ctx) return 'unsupported';
      if (!(await resume(ctx))) return 'blocked';
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
