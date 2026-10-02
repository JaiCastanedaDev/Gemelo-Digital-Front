import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('con tone muestra el ícono de estado oculto a lectores de pantalla junto a la etiqueta', () => {
    const { container } = render(<KpiCard label="Alertas críticas" value={3} tone="CRITICAL" />);
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Alertas críticas')).toBeInTheDocument();
    expect(screen.getByText('Alertas críticas').parentElement).toContainElement(icon as SVGElement);
  });

  it('usa un ícono distinto para cada tono', () => {
    const critical = render(<KpiCard label="A" value={1} tone="CRITICAL" />).container.querySelector('svg')?.outerHTML;
    const ok = render(<KpiCard label="B" value={1} tone="OK" />).container.querySelector('svg')?.outerHTML;
    expect(critical).toBeDefined();
    expect(ok).toBeDefined();
    expect(critical).not.toBe(ok);
  });

  it('sin tone no muestra ícono', () => {
    const { container } = render(<KpiCard label="Total" value={10} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
