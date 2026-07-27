import { test, expect } from '@playwright/test';

/**
 * routes-coverage.spec.ts
 *
 * Cubre rutas públicas, guest, alias y fallback, además de guardas
 * laterales que no forman parte de los flujos auth principales.
 */

test.describe('Cobertura de rutas públicas y guest', () => {
  test('páginas legales públicas cargan correctamente', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: /t[eé]rminos y condiciones|terms and conditions|termos e condicoes/i })).toBeVisible();

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /pol[ií]tica de privacidad|privacy policy|politica de privacidade/i })).toBeVisible();

    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: /preguntas frecuentes|frequently asked questions|perguntas frequentes/i }).first()).toBeVisible();
  });

  test('guest categories carga sin login', async ({ page }) => {
    await page.goto('/guest/categories');
    await expect(page).not.toHaveURL(/auth\/login|\/login/i);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('guest service-search carga y mantiene flujo guest', async ({ page }) => {
    await page.goto('/guest/service-search').catch(() => null);
    await expect.poll(() => page.url()).toMatch(/\/guest\/(service-search|categories)/i);
    await expect(page).not.toHaveURL(/auth\/login|\/login/i);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('landing de proveedor canónica y alias funcionan', async ({ page }) => {
    await page.goto('/registro-proveedores');
    await expect(page).not.toHaveURL(/500|error/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/proveedores');
    await expect(page).toHaveURL(/\/registro-proveedores/i);
  });

  test('bridge app-payment carga estructura de aplicación', async ({ page }) => {
    await page.goto('/app-payment');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/i);
  });
});

test.describe('Cobertura de guardas no autenticadas', () => {
  test('rutas compartidas protegidas redirigen a login', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL(/auth\/login|\/login/i);

    await page.goto('/payment/callback');
    await expect(page).toHaveURL(/auth\/login|\/login/i);
  });

  test('rutas cliente laterales redirigen a login', async ({ page }) => {
    await page.goto('/client/categories');
    await expect(page).toHaveURL(/auth\/login|\/login/i);

    await page.goto('/client/settings');
    await expect(page).toHaveURL(/auth\/login|\/login/i);
  });

  test('rutas proveedor laterales redirigen a login', async ({ page }) => {
    await page.goto('/provider/account-info');
    await expect(page).toHaveURL(/auth\/login|\/login/i);

    await page.goto('/provider/chat/1');
    await expect(page).toHaveURL(/auth\/login|\/login/i);
  });

  test('ruta inexistente cae en fallback de login', async ({ page }) => {
    await page.goto('/ruta/inexistente-e2e-check');
    await expect(page).toHaveURL(/auth\/login|\/login/i);
  });
});
