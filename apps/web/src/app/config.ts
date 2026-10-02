import type { ValidationMode } from '@gd/api';

export const config: { useMocks: boolean; apiBaseUrl: string; realtimeUrl: string; validation: ValidationMode } = {
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin,
  validation: import.meta.env.DEV ? 'strict' : 'lenient',
};
