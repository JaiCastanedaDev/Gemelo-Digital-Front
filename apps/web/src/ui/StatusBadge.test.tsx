import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, statusLabel } from './StatusBadge';

const NOW = new Date('2026-10-02T21:45:00Z');
const n = (s: string) => s.replace(/\s/g, ' ');

describe('statusLabel', () => {
  it('tiene texto para cada estado', () => {
    expect(statusLabel('CRITICAL', null, NOW)).toBe('Crítico');
    expect(statusLabel('WARNING', null, NOW)).toBe('Advertencia');
    expect(statusLabel('INFO', null, NOW)).toBe('Informativo');
    expect(statusLabel('OK', null, NOW)).toBe('Normal');
  });
  it('OFFLINE dice desde cuándo no hay datos', () => {
    expect(n(statusLabel('OFFLINE', '2026-10-02T20:45:00Z', NOW))).toMatch(/^Sin datos desde 3:45 p\. ?m\.$/);
    expect(statusLabel('OFFLINE', null, NOW)).toBe('Sin datos');
  });
  it('OFFLINE de hace más de un día incluye la fecha', () => {
    expect(n(statusLabel('OFFLINE', '2026-09-28T20:45:00Z', NOW))).toMatch(/^Sin datos desde 28 (de )?sept?\.?/);
  });
});

describe('StatusBadge', () => {
  it('muestra icono decorativo + texto y expone el nivel', () => {
    const { container } = render(<StatusBadge level="CRITICAL" />);
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(container.querySelector('[data-level="CRITICAL"] svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
