import { test, expect } from '@playwright/test';

/**
 * auth.spec.ts
 * Flujos de autenticación: Login y Registro de cliente.
 */

test.describe('Autenticación', () => {
  test('redirige a login cuando no hay sesión', async ({ page }) => {
    await page.goto('/client/home');
    await expect(page).toHaveURL(/login/);
  });

  test('muestra el formulario de login', async ({ page }) => {
    await page.goto('/auth/login?tab=login');
    const modal = page.locator('.modal-content');

    await expect(modal.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expect(modal.locator('form input[formcontrolname="email"]')).toBeVisible();
    await expect(modal.locator('#login-password')).toBeVisible();
  });

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/auth/login?tab=login');
    const modal = page.locator('.modal-content');

    await modal.locator('form input[formcontrolname="email"]').fill('invalido@test.com');
    await modal.locator('#login-password').fill('wrongpassword');
    await modal.locator('form button[type="submit"]').click();
    await expect(
      modal.locator('div').filter({ hasText: /credenciales|inválid|incorrect/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('navega a registro de cliente', async ({ page }) => {
    await page.goto('/auth/login?tab=login');
    const modal = page.locator('.modal-content');

    await modal.getByRole('button', { name: /registrarse/i }).click();
    await expect(modal.getByRole('heading', { name: /crear cuenta/i })).toBeVisible();
  });

  test('muestra el formulario de registro de cliente', async ({ page }) => {
    await page.goto('/auth/login?tab=register');
    const modal = page.locator('.modal-content');

    await expect(modal.getByRole('heading', { name: /crear cuenta/i })).toBeVisible();
    await expect(modal.locator('#register-name')).toBeVisible();
    await expect(modal.locator('#register-email')).toBeVisible();
    await expect(modal.locator('#register-password')).toBeVisible();
  });
});
