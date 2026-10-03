import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN, expectHome, login, waitForAppData } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const VIEWPORT_WIDTH = 390;

test.use({ viewport: { width: VIEWPORT_WIDTH, height: 844 } });

test('a 390 px la cabecera no desborda y el botón de sonido es alcanzable', async ({ page }) => {
  // AudioContext suspendido cuyo resume() nunca responde: el sonido queda bloqueado.
  await page.addInitScript(() => {
    class BlockedAudioContext {
      state = 'suspended';
      resume(): Promise<void> {
        return new Promise<void>(() => undefined);
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: BlockedAudioContext, configurable: true, writable: true });
  });
  await login(page, ADMIN);
  await expectHome(page);
  await waitForAppData(page);
  await page.evaluate(() => window.__gdMocks?.emitAlert('CRITICAL'));
  const soundButton = page.getByRole('button', { name: 'Activar sonido' });
  await expect(soundButton).toBeVisible();

  const noHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noHorizontalScroll).toBe(true);

  const header = page.getByRole('banner');
  for (const button of await header.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORT_WIDTH);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await expect(header.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});
