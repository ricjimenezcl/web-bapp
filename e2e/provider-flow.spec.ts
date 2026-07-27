import { test, expect } from '@playwright/test';

/**
 * provider-flow.spec.ts — web-bapp
 * Flujos del proveedor: home, servicios, reservas, perfil.
 */

test.describe('Flujo Proveedor — guards', () => {
  test('home del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/home');
    await expect(page).toHaveURL(/login/);
  });

  test('mis servicios redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/my-services');
    await expect(page).toHaveURL(/login/);
  });

  test('reservas del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/bookings');
    await expect(page).toHaveURL(/login/);
  });

  test('agregar servicio redirige a login', async ({ page }) => {
    await page.goto('/provider/add-service');
    await expect(page).toHaveURL(/login/);
  });

  test('editar servicio redirige a login', async ({ page }) => {
    await page.goto('/provider/edit-service/1');
    await expect(page).toHaveURL(/login/);
  });

  test('horarios de trabajo redirigen a login', async ({ page }) => {
    await page.goto('/provider/working-hours');
    await expect(page).toHaveURL(/login/);
  });

  test('bandeja de entrada del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/inbox');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Landing del proveedor (pública)', () => {
  test('provider-landing carga sin sesión', async ({ page }) => {
    await page.goto('/registro-proveedores');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/login|500|error/);
  });

  test('provider-landing tiene CTA de registro', async ({ page }) => {
    await page.goto('/registro-proveedores');
    const cta = page.getByRole('button', { name: /registrarme gratis|registrarme/i });
    await expect(cta.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Con sesión de proveedor (descomentar tras generar storageState) ──────────
//
// test.describe('Proveedor autenticado', () => {
//   test.use({ storageState: 'e2e/.auth/provider.json' });
//
//   test('home del proveedor muestra estadísticas', async ({ page }) => {
//     await page.goto('/provider/tabs/home');
//     await expect(page).toHaveURL(/home/);
//     await expect(page.locator('app-root')).toBeVisible();
//   });
//
//   test('puede crear un nuevo servicio', async ({ page }) => {
//     await page.goto('/provider/add-service');
//     await expect(page.getByRole('heading', { name: /agregar|nuevo servicio/i })).toBeVisible();
//   });
// });
