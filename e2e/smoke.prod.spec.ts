import { test, expect } from '@playwright/test';

/**
 * smoke.prod.spec.ts
 *
 * Smoke no destructivo para producción.
 * No crea, edita ni elimina datos.
 */

test.describe('Smoke Produccion', () => {
  test('home publica carga y responde', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/i);
  });

  test('login carga formulario', async ({ page }) => {
    await page.goto('/auth/login?tab=login');
    const modal = page.locator('.modal-content');

    await expect(modal.locator('form input[formcontrolname="email"]')).toBeVisible();
    await expect(modal.locator('#login-password')).toBeVisible();
    await expect(modal.locator('form button[type="submit"]')).toBeVisible();
  });

  test('landing proveedor publica carga', async ({ page }) => {
    await page.goto('/provider-landing');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/i);
  });

  test('rutas protegidas redirigen a login sin sesion', async ({ page }) => {
    await page.goto('/client/tabs/bookings');
    await expect(page).toHaveURL(/auth\/login|login/i);

    await page.goto('/provider/tabs/home');
    await expect(page).toHaveURL(/auth\/login|login/i);

    await page.goto('/notifications');
    await expect(page).toHaveURL(/auth\/login|login/i);
  });
});
