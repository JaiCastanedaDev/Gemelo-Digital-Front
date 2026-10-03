import { expect, type Page } from '@playwright/test';

export const ADMIN = 'admin@demo.co';
export const RESIDENTE = 'residente@demo.co';
export const PASSWORD = 'Demo1234!';

export async function login(page: Page, email: string, password = PASSWORD, path = '/login') {
  await page.goto(path);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

export async function expectHome(page: Page) {
  await expect(page.getByRole('heading', { name: 'Estado general', level: 1 })).toBeVisible();
}

/** Espera a que los datos estén renderizados (el cliente en tiempo real ya se suscribió). */
export async function waitForAppData(page: Page) {
  await expect(page.getByRole('link', { name: /^Alertas: \d+ sin revisar/ })).toBeVisible();
}
