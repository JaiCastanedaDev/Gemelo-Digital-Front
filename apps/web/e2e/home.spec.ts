import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login } from './helpers';

test('escenario crítico: banner, puntaje y enlace a la alerta en 1 clic', async ({ page }) => {
  await login(page, ADMIN, 'Demo1234!', '/login?escenario=critico');
  await expectHome(page);
  const banner = page.getByRole('region', { name: 'Alertas críticas sin revisar' });
  await expect(banner).toContainText('1 alerta crítica sin revisar');
  const health = page.getByRole('region', { name: 'Salud del edificio' });
  await expect(health).toContainText('56');
  await expect(health).toContainText('Requiere atención');
  await banner.getByRole('link', { name: 'Ver alerta' }).click();
  await expect(page).toHaveURL(/\/alertas\?alerta=alrt-\d{8}-00004$/);
});

test('escenario vacío: edificio sin alertas', async ({ page }) => {
  await login(page, ADMIN, 'Demo1234!', '/login?escenario=vacio');
  const health = page.getByRole('region', { name: 'Salud del edificio' });
  await expect(health).toContainText('100');
  await expect(health).toContainText('Sin alertas abiertas ni sensores sin datos.');
});
