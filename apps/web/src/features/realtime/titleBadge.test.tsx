import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BASE_TITLE, badgeTitle, useTitleBadge } from './titleBadge';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  setVisibility('visible');
  document.title = BASE_TITLE;
});

describe('badgeTitle', () => {
  it('sin pendientes deja el título base', () => {
    expect(badgeTitle('Gemelo Digital', 0, false)).toBe('Gemelo Digital');
  });
  it('indica cuántas llegaron y si hay críticas', () => {
    expect(badgeTitle('Gemelo Digital', 2, true)).toBe('(2) ⚠ Alerta crítica · Gemelo Digital');
    expect(badgeTitle('Gemelo Digital', 1, false)).toBe('(1) ⚠ Nueva alerta · Gemelo Digital');
  });
});

describe('useTitleBadge', () => {
  it('con la pestaña visible no toca el título', () => {
    document.title = BASE_TITLE;
    const { result } = renderHook(() => useTitleBadge());
    act(() => result.current('CRITICAL'));
    expect(document.title).toBe(BASE_TITLE);
  });

  it('con la pestaña oculta acumula y al volver restaura', () => {
    document.title = BASE_TITLE;
    const { result } = renderHook(() => useTitleBadge());
    act(() => setVisibility('hidden'));
    act(() => result.current('WARNING'));
    act(() => result.current('CRITICAL'));
    expect(document.title).toBe('(2) ⚠ Alerta crítica · Gemelo Digital');
    act(() => setVisibility('visible'));
    expect(document.title).toBe(BASE_TITLE);
  });
});
