import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESUME_TIMEOUT_MS, createAlertSound } from './alertSound';

class FakeAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  value = 0;
}
class FakeNode {
  frequency = new FakeAudioParam();
  gain = new FakeAudioParam();
  type = 'sine';
  connect = vi.fn((target: unknown) => target);
  start = vi.fn();
  stop = vi.fn();
}

function fakeContextCtor(initialState: AudioContextState, resumeWorks: boolean) {
  const created: FakeContext[] = [];
  class FakeContext {
    state: AudioContextState = initialState;
    currentTime = 0;
    destination = {};
    oscillators: FakeNode[] = [];
    constructor() {
      created.push(this);
    }
    resume = vi.fn(async () => {
      if (!resumeWorks) throw new Error('NotAllowedError');
      this.state = 'running';
    });
    createOscillator() {
      const node = new FakeNode();
      this.oscillators.push(node);
      return node;
    }
    createGain() {
      return new FakeNode();
    }
  }
  return { Ctor: FakeContext as unknown as new () => AudioContext, created };
}

describe('createAlertSound', () => {
  it('suena si el contexto de audio está activo', async () => {
    const { Ctor, created } = fakeContextCtor('running', true);
    const sound = createAlertSound(() => Ctor);
    await expect(sound.play()).resolves.toBe('played');
    expect(created[0]?.oscillators.length).toBeGreaterThan(0);
  });

  it('informa "blocked" sin lanzar si el navegador bloquea el audio', async () => {
    const { Ctor } = fakeContextCtor('suspended', false);
    const sound = createAlertSound(() => Ctor);
    await expect(sound.play()).resolves.toBe('blocked');
    await expect(sound.unlock()).resolves.toBe(false);
  });

  it('unlock reactiva el audio tras un gesto del usuario', async () => {
    const { Ctor } = fakeContextCtor('suspended', true);
    const sound = createAlertSound(() => Ctor);
    await expect(sound.unlock()).resolves.toBe(true);
    await expect(sound.play()).resolves.toBe('played');
  });

  it('sin Web Audio responde "unsupported"', async () => {
    const sound = createAlertSound(() => undefined);
    await expect(sound.play()).resolves.toBe('unsupported');
    await expect(sound.unlock()).resolves.toBe(false);
  });
});

describe('createAlertSound con resume() que nunca se resuelve (Chrome/Firefox sin gesto)', () => {
  function hangingContextCtor(resumeResult: 'pending' | 'fast') {
    const created: HangingContext[] = [];
    class HangingContext {
      state: AudioContextState = 'suspended';
      currentTime = 0;
      destination = {};
      oscillators: FakeNode[] = [];
      settleResume: () => void = () => undefined;
      constructor() {
        created.push(this);
      }
      resume = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            const settle = () => {
              this.state = 'running';
              resolve();
            };
            if (resumeResult === 'fast') settle();
            else this.settleResume = settle;
          }),
      );
      createOscillator() {
        const node = new FakeNode();
        this.oscillators.push(node);
        return node;
      }
      createGain() {
        return new FakeNode();
      }
    }
    return { Ctor: HangingContext as unknown as new () => AudioContext, created };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('responde "blocked" tras RESUME_TIMEOUT_MS y no crea osciladores', async () => {
    vi.useFakeTimers();
    const { Ctor, created } = hangingContextCtor('pending');
    const sound = createAlertSound(() => Ctor);
    const result = sound.play();
    await vi.advanceTimersByTimeAsync(RESUME_TIMEOUT_MS);
    await expect(result).resolves.toBe('blocked');
    expect(created[0]?.oscillators).toHaveLength(0);
  });

  it('si resume() se resuelve después de "blocked", no suena retroactivamente', async () => {
    vi.useFakeTimers();
    const { Ctor, created } = hangingContextCtor('pending');
    const sound = createAlertSound(() => Ctor);
    const result = sound.play();
    await vi.advanceTimersByTimeAsync(RESUME_TIMEOUT_MS);
    await expect(result).resolves.toBe('blocked');
    created[0]?.settleResume();
    await vi.advanceTimersByTimeAsync(1000);
    expect(created[0]?.state).toBe('running');
    expect(created[0]?.oscillators).toHaveLength(0);
  });

  it('si resume() resuelve a tiempo a "running", suena', async () => {
    vi.useFakeTimers();
    const { Ctor, created } = hangingContextCtor('fast');
    const sound = createAlertSound(() => Ctor);
    const result = sound.play();
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toBe('played');
    expect(created[0]?.oscillators.length).toBeGreaterThan(0);
  });

  it('unlock espera resume() y después play() suena', async () => {
    const { Ctor, created } = hangingContextCtor('fast');
    const sound = createAlertSound(() => Ctor);
    await expect(sound.unlock()).resolves.toBe(true);
    await expect(sound.play()).resolves.toBe('played');
    expect(created[0]?.oscillators.length).toBeGreaterThan(0);
  });
});
