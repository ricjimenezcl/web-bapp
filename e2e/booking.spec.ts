import { test, expect, Page } from '@playwright/test';

/**
 * booking.spec.ts — web-bapp
 *
 * Flujo de reservas completo (cliente + proveedor).
 * Rutas protegidas → verificamos que el guard redirige a login (sin sesión)
 * y que la estructura de páginas es correcta cuando hay sesión activa.
 *
 * Para tests con sesión real:
 *   1. Ejecutar `npx playwright codegen http://localhost:4200` y loguear
 *   2. Guardar storageState con: await page.context().storageState({ path: 'e2e/.auth/client.json' })
 *   3. Usar: test.use({ storageState: 'e2e/.auth/client.json' })
 */

// ── Sin sesión: guards redirigen a login ─────────────────────────────────────

test.describe('Reservas — guard de autenticación', () => {
  test('reservas del cliente redirige a login', async ({ page }) => {
    await page.goto('/client/tabs/bookings');
    await expect(page).toHaveURL(/login/);
  });

  test('reservas del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/bookings');
    await expect(page).toHaveURL(/login/);
  });

  test('detalle de proveedor redirige a login', async ({ page }) => {
    await page.goto('/client/provider-info/1');
    await expect(page).toHaveURL(/login/);
  });

  test('búsqueda de servicio redirige a login', async ({ page }) => {
    await page.goto('/client/tabs/service-search');
    await expect(page).toHaveURL(/login/);
  });

  test('mapa de servicios redirige a login', async ({ page }) => {
    await page.goto('/client/tabs/service-map');
    await expect(page).toHaveURL(/login/);
  });
});

// ── Pago ─────────────────────────────────────────────────────────────────────

test.describe('Pago — guard de autenticación', () => {
  test('página de pago redirige a login sin sesión', async ({ page }) => {
    await page.goto('/payment');
    await expect(page).toHaveURL(/login/);
  });

  test('bridge de pago móvil carga sin error', async ({ page }) => {
    await page.goto('/app-payment');
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page).not.toHaveURL(/500|error/);
  });
});

// ── Flujo completo con sesión (requiere storageState) ────────────────────────
// Para activar: descomentar y generar e2e/.auth/client.json
//
// test.describe('Reservas — flujo cliente autenticado', () => {
//   test.use({ storageState: 'e2e/.auth/client.json' });
//
//   test('lista de reservas carga correctamente', async ({ page }) => {
//     await page.goto('/client/tabs/bookings');
//     await expect(page).toHaveURL(/bookings/);
//     await expect(page.locator('app-root')).toBeVisible();
//   });
//
//   test('detalle de proveedor muestra botón de reservar', async ({ page }) => {
//     await page.goto('/client/tabs/service-search');
//     // click en primer proveedor disponible
//     await page.locator('[data-testid="provider-card"]').first().click();
//     await expect(page).toHaveURL(/provider-info/);
//     await expect(page.getByRole('button', { name: /reservar|contratar/i })).toBeVisible();
//   });
//
//   test('flujo de pago se inicia desde proveedor-info', async ({ page }) => {
//     await page.goto('/client/provider-info/1');
//     await page.getByRole('button', { name: /reservar|contratar/i }).click();
//     // Debe navegar a payment o mostrar modal
//     await expect(page.url()).toMatch(/payment|booking/);
//   });
// });
