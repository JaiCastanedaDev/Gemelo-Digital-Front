import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, RESIDENTE, expectHome, login, waitForAppData } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('tabla de sensores → detalle con serie, rango y tabla alternativa', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Sensores' }).click();
  const table = page.getByRole('table', { name: 'Sensores (22)' });
  await expect(table).toBeVisible();
  await table.getByRole('link', { name: 'Medidor acueducto principal' }).click();
  await expect(page).toHaveURL(/\/sensores\?sensor=water-main$/);
  const panel = page.getByRole('complementary', { name: 'Detalle del sensor' });
  await expect(panel.getByRole('img', { name: 'Serie de Medidor acueducto principal, 24 horas' })).toBeVisible();
  await panel.getByRole('button', { name: '7 días' }).click();
  await expect(page).toHaveURL(/rango=7d/);
  await expect(panel.getByRole('img', { name: 'Serie de Medidor acueducto principal, 7 días' })).toBeVisible();
  await panel.getByRole('button', { name: 'Ver como tabla' }).click();
  await expect(panel.getByRole('table', { name: 'Lecturas de Medidor acueducto principal' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('desde una alerta se llega al sensor', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page
    .getByRole('region', { name: 'Alertas críticas sin revisar' })
    .getByRole('link', { name: 'Ver alerta' })
    .click();
  await page
    .getByRole('complementary', { name: 'Detalle de la alerta' })
    .getByRole('link', { name: 'Ver sensor' })
    .click();
  await expect(page).toHaveURL(/\/sensores\?sensor=acc-t1-sotano$/);
  await expect(page.getByRole('complementary', { name: 'Detalle del sensor' })).toContainText(
    'Acelerómetro Sótano Torre 1',
  );
});

test('el residente no puede entrar a sensores', async ({ page }) => {
  await login(page, RESIDENTE);
  await expectHome(page);
  await page.goto('/sensores');
  await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();
});
