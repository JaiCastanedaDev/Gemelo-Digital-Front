import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('login sin violaciones WCAG AA', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test('home en escenario crítico sin violaciones WCAG AA', async ({ page }) => {
  await login(page, ADMIN, 'Demo1234!', '/login?escenario=critico');
  await expectHome(page);
  await expect(page.getByRole('region', { name: 'Salud del edificio' })).toContainText('56');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});
