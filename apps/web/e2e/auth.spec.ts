import { expect, test } from '@playwright/test';
import { ADMIN, RESIDENTE, expectHome, login } from './helpers';

test('el administrador entra, recarga y sigue con sesión', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await page.reload();
  await expectHome(page);
});

test('una ruta protegida sin sesión vuelve a ella tras el login', async ({ page }) => {
  await page.goto('/aire');
  await expect(page).toHaveURL(/\/login\?volver=%2Faire/);
  await page.getByLabel('Correo electrónico').fill(ADMIN);
  await page.getByLabel('Contraseña').fill('Demo1234!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Calidad del aire' })).toBeVisible();
});

test('el residente no ve secciones de administración y recibe "sin permiso"', async ({ page }) => {
  await login(page, RESIDENTE);
  await expectHome(page);
  const nav = page.getByRole('navigation', { name: 'Secciones' });
  await expect(nav.getByRole('link', { name: 'Calidad del aire' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Sensores' })).toHaveCount(0);
  await page.goto('/sensores');
  await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();
});

test('bloqueo de cuenta tras 5 intentos fallidos', async ({ page }) => {
  await page.goto('/login');
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Correo electrónico').fill(ADMIN);
    await page.getByLabel('Contraseña').fill('incorrecta');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await expect(page.getByRole('alert')).toContainText('bloqueada temporalmente');
});

test('cerrar sesión vuelve al login y no restaura la sesión al recargar', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('si la sesión expira aparece el modal y se recupera sin perder la pantalla', async ({ page }) => {
  await page.clock.install();
  await login(page, ADMIN);
  await expectHome(page);
  // Esperar al primer dato real: así no hay una consulta en vuelo con el token vigente y el sondeo de 30 s ya está armado.
  await expect(page.getByRole('region', { name: 'Salud del edificio' })).toContainText('/100');
  await page.evaluate(() => {
    window.__gdMocks?.expireAccessTokens();
    window.__gdMocks?.revokeRefreshTokens();
  });
  await page.clock.fastForward('00:31');
  const dialog = page.getByRole('dialog', { name: 'Tu sesión expiró' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Contraseña').fill('Demo1234!');
  await dialog.getByRole('button', { name: 'Ingresar' }).click();
  await expect(dialog).toBeHidden();
  await expectHome(page);
});
