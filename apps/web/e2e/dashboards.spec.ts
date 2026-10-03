import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, RESIDENTE, expectHome, login } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('estructural en escenario crítico', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/estructural');
  const health = page.getByRole('region', { name: 'Salud estructural' });
  await expect(health).toContainText('60');
  await expect(health).toContainText('Requiere atención');
  await expect(page.getByRole('region', { name: 'Sensores en alerta' })).toContainText('Acelerómetro Sótano Torre 1');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('consumos con y sin periodo anterior', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=caido');
  await expectHome(page);
  await page.goto('/consumos');
  await expect(page.getByRole('region', { name: 'Consumo en m³' })).toContainText(
    '↑ 12,2 % frente al mismo tramo del mes anterior',
  );
  await expect(page.getByRole('region', { name: 'Consumo en kWh' })).toContainText('Sin datos del periodo anterior');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('calidad del aire: el administrador ve ppm; el residente no', async ({ page, browser }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/aire');
  await expect(page.getByRole('listitem', { name: 'Salón social' })).toContainText('1.450 ppm');

  const residentContext = await browser.newContext({ locale: 'es-CO', timezoneId: 'America/Bogota' });
  const resident = await residentContext.newPage();
  await login(resident, RESIDENTE, PASSWORD, '/login?escenario=critico');
  await expectHome(resident);
  await resident.goto('/aire');
  const salon = resident.getByRole('listitem', { name: 'Salón social' });
  await expect(salon).toContainText('Mala');
  await expect(resident.getByText(/ppm/)).toHaveCount(0);
  const results = await new AxeBuilder({ page: resident }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
  await residentContext.close();
});

test('filtros de alertas por sensor viven en la URL', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/alertas');
  await page.getByLabel('Sensor').selectOption('acc-t1-sotano');
  await expect(page).toHaveURL(/sensor=acc-t1-sotano/);
  await expect(page.getByRole('list', { name: 'Alertas' }).getByRole('link')).toHaveCount(1);
});
