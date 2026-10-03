import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD, expectHome, login } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const horizontalOverflow = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

for (const path of ['/sensores', '/estructural', '/consumos', '/aire', '/alertas']) {
  test(`a 390 px ${path} no tiene desplazamiento horizontal`, async ({ page }) => {
    await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
    await expectHome(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    const overflow = await page.evaluate(horizontalOverflow);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('a 390 px el detalle del sensor cabe y la gráfica se ve', async ({ page }) => {
  await login(page, ADMIN, PASSWORD, '/login?escenario=critico');
  await expectHome(page);
  await page.goto('/sensores?sensor=water-main');
  const panel = page.getByRole('complementary', { name: 'Detalle del sensor' });
  await expect(panel.getByRole('img', { name: /Serie de Medidor acueducto principal/ })).toBeVisible();
  const overflow = await page.evaluate(horizontalOverflow);
  expect(overflow).toBeLessThanOrEqual(0);
});
