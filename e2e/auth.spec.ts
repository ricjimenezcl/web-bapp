import { test, expect } from '@playwright/test';

/**
 * auth.spec.ts
 * Flujos de autenticación: Login y Registro de cliente.
 */

test.describe('Autenticación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('redirige a login cuando no hay sesión', async ({ page }) => {
    await page.goto('/client/home');
    await expect(page).toHaveURL(/login/);
  });

  test('muestra el formulario de login', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expect(page.getByLabel(/correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
  });

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/correo/i).fill('invalido@test.com');
    await page.getByLabel(/contraseña/i).fill('wrongpassword');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page.getByText(/credenciales|contraseña|correo/i)).toBeVisible({ timeout: 8000 });
  });

  test('navega a registro de cliente', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: /regístrate|crear cuenta/i }).click();
    await expect(page).toHaveURL(/register/);
  });

  test('muestra el formulario de registro de cliente', async ({ page }) => {
    await page.goto('/auth/register-client');
    await expect(page.getByLabel(/nombre/i)).toBeVisible();
    await expect(page.getByLabel(/correo/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
  });
});
