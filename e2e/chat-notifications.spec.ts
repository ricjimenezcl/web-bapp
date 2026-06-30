import { test, expect } from '@playwright/test';

/**
 * chat-notifications.spec.ts — web-bapp
 * Flujos de chat y notificaciones.
 */

test.describe('Chat — guards', () => {
  test('chat del cliente redirige a login', async ({ page }) => {
    await page.goto('/client/chats');
    await expect(page).toHaveURL(/login/);
  });

  test('chat del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/inbox');
    await expect(page).toHaveURL(/login/);
  });

  test('conversación específica redirige a login', async ({ page }) => {
    await page.goto('/client/chat/1');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Notificaciones — guards', () => {
  test('página de notificaciones redirige a login', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Perfil de usuario — guards', () => {
  test('perfil del cliente redirige a login', async ({ page }) => {
    await page.goto('/client/tabs/profile');
    await expect(page).toHaveURL(/login/);
  });

  test('editar perfil redirige a login', async ({ page }) => {
    await page.goto('/client/edit-profile');
    await expect(page).toHaveURL(/login/);
  });

  test('perfil del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/profile');
    await expect(page).toHaveURL(/login/);
  });

  test('configuración redirige a login', async ({ page }) => {
    await page.goto('/client/settings');
    await expect(page).toHaveURL(/login/);
  });
});
