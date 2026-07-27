import { test, expect } from '@playwright/test';

/**
 * email-verification.spec.ts
 * Flujo de verificación de email (desktop y mobile).
 */

test.describe('Verificación de email', () => {
  test('token inválido muestra estado de error', async ({ page }) => {
    await page.goto('/auth/verify-email?token=token-invalido-123');
    await expect(page.locator('app-root')).toBeVisible();

    const expiredHeading = page.getByRole('heading', { name: /enlace expirado/i });
    const errorHeading = page.getByRole('heading', { name: /error de verificación/i });

    await expect(expiredHeading.or(errorHeading)).toBeVisible({ timeout: 10000 });
  });

  test('sin token redirige correctamente', async ({ page }) => {
    await page.goto('/auth/verify-email');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.getByRole('heading', { name: /error de verificación/i })).toBeVisible();
    await expect(page.getByText(/token inválido|token invalido/i)).toBeVisible();
  });
});

test.describe('Verificación de email — Mobile (Pixel 5)', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('mobile muestra estado de verificación sin pantalla en blanco', async ({ page }) => {
    await page.goto('/auth/verify-email?token=token-invalido-123');
    await expect(page.locator('app-root')).toBeVisible();

    const expiredHeading = page.getByRole('heading', { name: /enlace expirado/i });
    const errorHeading = page.getByRole('heading', { name: /error de verificación/i });
    await expect(expiredHeading.or(errorHeading)).toBeVisible({ timeout: 10000 });
  });
});
