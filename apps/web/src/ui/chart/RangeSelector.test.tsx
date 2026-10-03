import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RangeSelector } from './RangeSelector';

describe('RangeSelector', () => {
  it('marca el rango activo y avisa el cambio', async () => {
    const onChange = vi.fn();
    render(<RangeSelector value="24h" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Rango de tiempo' });
    expect(within(group).getByRole('button', { name: '24 horas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(group).getByRole('button', { name: '7 días' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });
});
