import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EChart } from './EChart';

describe('EChart', () => {
  it('expone un nombre accesible aunque el lienzo no se haya dibujado', () => {
    render(<EChart option={{}} label="Serie de Acelerómetro, 24 horas" />);
    expect(screen.getByRole('img', { name: 'Serie de Acelerómetro, 24 horas' })).toBeInTheDocument();
  });
});
