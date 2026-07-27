import { chromium, FullConfig } from '@playwright/test';

/**
 * global-setup.ts — web-bapp
 *
 * Genera storageState con sesión activa para tests que requieren autenticación.
 * Solo se ejecuta si las variables de entorno TEST_CLIENT_EMAIL/PASSWORD están definidas.
 *
 * Uso en CI:
 *   TEST_CLIENT_EMAIL=test@bapp.com TEST_CLIENT_PASSWORD=pass123 npx playwright test
 *
 * Uso local — generar manualmente:
 *   npx playwright codegen --save-storage=e2e/.auth/client.json http://localhost:4200
 */

async function globalSetup(config: FullConfig) {
  const clientEmail = process.env.TEST_CLIENT_EMAIL;
  const clientPassword = process.env.TEST_CLIENT_PASSWORD;
  const providerEmail = process.env.TEST_PROVIDER_EMAIL;
  const providerPassword = process.env.TEST_PROVIDER_PASSWORD;

  if (!clientEmail || !clientPassword) {
    console.log('[QA] TEST_CLIENT_EMAIL/PASSWORD no definidas — tests autenticados omitidos');
    return;
  }

  const browser = await chromium.launch();
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:4200';

  const loginWithCredentials = async (page: import('@playwright/test').Page, email: string, password: string) => {
    await page.goto(`${baseURL}/auth/login?tab=login`);
    const modal = page.locator('.modal-content');
    await modal.locator('form input[formcontrolname="email"]').fill(email);
    await modal.locator('#login-password').fill(password);
    await modal.locator('form button[type="submit"]').click();
  };

  // ── Sesión cliente ─────────────────────────────────────────────────────────
  const clientCtx = await browser.newContext();
  const clientPage = await clientCtx.newPage();
  await loginWithCredentials(clientPage, clientEmail, clientPassword);
  await clientPage.waitForURL(/client\/tabs|bookings/, { timeout: 10_000 }).catch(() => {});
  await clientCtx.storageState({ path: 'e2e/.auth/client.json' });
  await clientCtx.close();
  console.log('[QA] storageState cliente guardado en e2e/.auth/client.json');

  // ── Sesión proveedor ───────────────────────────────────────────────────────
  if (providerEmail && providerPassword) {
    const providerCtx = await browser.newContext();
    const providerPage = await providerCtx.newPage();
    await loginWithCredentials(providerPage, providerEmail, providerPassword);
    await providerPage.waitForURL(/provider\/tabs|home/, { timeout: 10_000 }).catch(() => {});
    await providerCtx.storageState({ path: 'e2e/.auth/provider.json' });
    await providerCtx.close();
    console.log('[QA] storageState proveedor guardado en e2e/.auth/provider.json');
  }

  await browser.close();
}

export default globalSetup;
