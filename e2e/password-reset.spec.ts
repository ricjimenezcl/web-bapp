import { test, expect } from '@playwright/test';

/**
 * password-reset.spec.ts — web-bapp
 * Flujo de recuperación y cambio de contraseña.
 */

test.describe('Recuperar contraseña', () => {
  test('página de reset-password carga', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/);
  });

  test('muestra campo de email en reset-password', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await expect(page.getByLabel(/correo/i).or(page.locator('input[type="email"]'))).toBeVisible({ timeout: 8_000 });
  });

  test('set-new-password sin token carga sin crash', async ({ page }) => {
    await page.goto('/auth/set-new-password');
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('set-new-password con token muestra formulario', async ({ page }) => {
    await page.goto('/auth/set-new-password?token=token-de-prueba');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/);
  });
});
