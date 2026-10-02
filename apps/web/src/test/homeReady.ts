import { screen, within } from '@testing-library/react';

/**
 * Espera a que el home muestre el puntaje (datos cargados). La región existe desde el primer commit,
 * pero el cliente de tiempo real arranca en un efecto pasivo: esperar un render posterior garantiza
 * que ya está suscrito al bus antes de emitir.
 */
export async function homeReady(): Promise<void> {
  const region = await screen.findByRole('region', { name: 'Salud del edificio' });
  await within(region).findByText(/^\d+$/);
}
