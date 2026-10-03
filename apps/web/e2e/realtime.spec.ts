import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login, waitForAppData } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const NOTIFICATIONS = 'section[aria-label="Notificaciones"]';

test('una alerta crítica en tiempo real se abre en un clic desde la notificación', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await expect(page.getByRole('link', { name: 'Alertas: 2 sin revisar' })).toBeVisible();

  const alertId = await page.evaluate(() => window.__gdMocks?.emitAlert('CRITICAL'));
  const criticalToasts = page.locator(NOTIFICATIONS).getByRole('alert');
  await expect(criticalToasts).toContainText('Aceleración superior al umbral configurado');
  await expect(page.getByRole('link', { name: 'Alertas: 3 sin revisar, incluye críticas' })).toBeVisible();

  await criticalToasts.getByRole('link', { name: 'Ver alerta' }).click();
  await expect(page).toHaveURL(new RegExp(`/alertas\\?alerta=${alertId}$`));
  await expect(page.getByRole('heading', { name: 'Detalle de la alerta' })).toBeVisible();
  await expect(criticalToasts).toBeEmpty();
});

test('una advertencia se cierra sola a los 8 segundos', async ({ page }) => {
  await page.clock.install();
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  await page.evaluate(() => window.__gdMocks?.emitAlert('WARNING'));
  const warnings = page.locator(NOTIFICATIONS).getByRole('status');
  await expect(warnings).toContainText('Cambio medido en la apertura de fisura');
  await page.clock.fastForward('00:09');
  await expect(warnings).toBeEmpty();
});

test('si cae el tiempo real el indicador lo dice y el banner aparece a los 5 s', async ({ page }) => {
  await page.clock.install();
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  await expect(page.getByText('En vivo')).toBeVisible();
  await page.evaluate(() => window.__gdMocks?.setRealtimeStatus('disconnected'));
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
  await page.clock.fastForward('00:06');
  await expect(page.getByText('Sin conexión con el servidor.')).toBeVisible();
  await page.evaluate(() => window.__gdMocks?.setRealtimeStatus('connected'));
  await expect(page.getByText('En vivo')).toBeVisible();
  await expect(page.getByText('Sin conexión con el servidor.')).toBeHidden();
});

test('sin red el banner aparece de inmediato', async ({ page, context }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  await context.setOffline(true);
  await expect(page.getByText('Sin conexión con el servidor.')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Sin conexión con el servidor.')).toBeHidden();
});

test('notificación y detalle sin violaciones WCAG AA', async ({ page }) => {
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  const alertId = await page.evaluate(() => window.__gdMocks?.emitAlert('CRITICAL'));
  await expect(page.locator(NOTIFICATIONS).getByRole('alert')).toContainText('Alerta crítica');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);

  // Navegación en cliente: una recarga completa reiniciaría el estado simulado y perdería la alerta emitida.
  await page.locator(NOTIFICATIONS).getByRole('link', { name: 'Ver alerta' }).click();
  await expect(page).toHaveURL(new RegExp(`/alertas\\?alerta=${alertId}$`));
  await expect(page.getByRole('heading', { name: 'Detalle de la alerta' })).toBeVisible();
  await expect(page.getByText('Valor medido')).toBeVisible();
  const detail = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(detail.violations).toEqual([]);
});
