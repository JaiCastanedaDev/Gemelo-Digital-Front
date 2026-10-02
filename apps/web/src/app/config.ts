import type { ValidationMode } from '@gd/api';

export const config: { useMocks: boolean; apiBaseUrl: string; validation: ValidationMode } = {
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  validation: import.meta.env.DEV ? 'strict' : 'lenient',
};
