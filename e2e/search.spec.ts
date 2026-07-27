import { test, expect } from '@playwright/test';

/**
 * search.spec.ts
 * Flujo de búsqueda de servicios (flujo crítico del cliente).
 */

test.describe('Búsqueda de servicios', () => {
  test('landing page carga correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/bapp/i);
    // La página pública (landing o login) debe cargarse sin error 500
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('ruta guest de búsqueda responde', async ({ page }) => {
    await page.goto('/guest/service-search').catch(() => null);
    await expect.poll(() => page.url()).toMatch(/\/guest\/(service-search|categories)/i);
    await expect(page).not.toHaveURL(/auth\/login|\/login/i);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('landing del proveedor carga', async ({ page }) => {
    await page.goto('/registro-proveedores');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/);
  });
});
