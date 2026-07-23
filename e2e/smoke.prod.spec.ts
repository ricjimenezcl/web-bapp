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
    await page.goto('/auth/login');
    await expect(page.getByLabel(/correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
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
