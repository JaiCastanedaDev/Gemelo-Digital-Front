import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, RESIDENTE, expectHome, login, waitForAppData } from './helpers';

test('crítica en ≤2 clics desde la campana y acuse optimista', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);

  await page.getByRole('link', { name: /Alertas: 4 sin revisar, incluye críticas/ }).click();
  const list = page.getByRole('list', { name: 'Alertas' });
  await list.getByRole('link').first().click();

  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  await expect(panel).toContainText('Aceleración superior al umbral configurado');
  await panel.getByRole('button', { name: 'Marcar como revisada' }).click();

  const dialog = page.getByRole('alertdialog', { name: '¿Marcar esta alerta como revisada?' });
  await expect(dialog).toContainText('Esto no resuelve la condición; si persiste, se volverá a registrar.');
  await dialog.getByRole('button', { name: 'Marcar como revisada' }).click();

  await expect(panel.getByText('Revisada', { exact: true })).toBeVisible();
  await expect(panel.getByText('Administración Demo')).toBeVisible();
});

test('el diálogo de acuse enfoca Cancelar y Escape devuelve el foco', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page
    .getByRole('region', { name: 'Alertas críticas sin revisar' })
    .getByRole('link', { name: 'Ver alerta' })
    .click();

  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  const trigger = panel.getByRole('button', { name: 'Marcar como revisada' });
  await trigger.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('si el servidor falla el acuse se revierte y se informa', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page
    .getByRole('region', { name: 'Alertas críticas sin revisar' })
    .getByRole('link', { name: 'Ver alerta' })
    .click();

  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  await expect(panel).toContainText('Sin revisar');
  await waitForAppData(page);
  await page.evaluate(() => window.__gdMocks?.failNextAck());
  await panel.getByRole('button', { name: 'Marcar como revisada' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como revisada' }).click();

  await expect(panel.getByRole('alert')).toContainText('No se pudo marcar la alerta como revisada.');
  await expect(panel).toContainText('Sin revisar');
});

test('el residente consulta alertas sin números y sin poder marcarlas', async ({ page }) => {
  await login(page, RESIDENTE, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/alertas');
  const list = page.getByRole('list', { name: 'Alertas' });
  await expect(list.getByRole('link').first()).toContainText('Crítico');
  await expect(list).not.toContainText('ocurrencias');

  await list.getByRole('link').first().click();
  const panel = page.getByRole('complementary', { name: 'Detalle de la alerta' });
  await expect(panel).toContainText('Aceleración superior al umbral configurado');
  await expect(panel.getByText('Valor medido')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Marcar como revisada' })).toHaveCount(0);
});

test('los filtros viven en la URL', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/alertas');
  await page.getByLabel('Nivel').selectOption('WARNING');
  await expect(page).toHaveURL(/\/alertas\?nivel=WARNING$/);
  const rows = page.getByRole('list', { name: 'Alertas' }).getByRole('link');
  await expect(rows.first()).toContainText('Advertencia');
  await expect(rows.filter({ hasNotText: 'Advertencia' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Nivel')).toHaveValue('WARNING');
});
