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

  test('página de búsqueda responde', async ({ page }) => {
    await page.goto('/search');
    // Debe redirigir a login o mostrar la búsqueda
    const url = page.url();
    expect(url).toMatch(/search|login/);
  });

  test('landing del proveedor carga', async ({ page }) => {
    await page.goto('/provider-landing');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/);
  });
});
