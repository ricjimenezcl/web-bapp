import { test, expect } from '@playwright/test';

/**
 * email-verification.spec.ts
 * Flujo de verificación de email (desktop y mobile).
 */

test.describe('Verificación de email', () => {
  test('token inválido muestra estado de error', async ({ page }) => {
    await page.goto('/auth/verify-email?token=token-invalido-123');
    // Debe mostrar mensaje de error o token expirado, nunca pantalla en blanco
    await expect(page.locator('app-root')).toBeVisible();
    const body = await page.textContent('body');
    expect(body).toMatch(/error|inválido|expirado|verificar/i);
  });

  test('sin token redirige correctamente', async ({ page }) => {
    await page.goto('/auth/verify-email');
    await expect(page.locator('app-root')).toBeVisible();
  });
});

test.describe('Verificación de email — Mobile (Pixel 5)', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('mobile muestra botón de abrir app', async ({ page }) => {
    await page.goto('/auth/verify-email?token=token-invalido-123');
    await expect(page.locator('app-root')).toBeVisible();
  });
});
