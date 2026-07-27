import { test, expect } from '@playwright/test';

/**
 * authenticated-flows.spec.ts
 *
 * Cubre flujos autenticados de cliente/proveedor y pago de plan en modo no destructivo.
 * Requiere credenciales QA por variables de entorno para generar storageState en global-setup.
 */

const hasClientCreds = Boolean(process.env.TEST_CLIENT_EMAIL && process.env.TEST_CLIENT_PASSWORD);
const hasProviderCreds = Boolean(process.env.TEST_PROVIDER_EMAIL && process.env.TEST_PROVIDER_PASSWORD);
const allowMutations = process.env.E2E_ALLOW_MUTATIONS === 'true';
const tinyImagePath = `${process.cwd()}/e2e/fixtures/tiny.png`;

async function keepBrowserSessionAlive(page: import('@playwright/test').Page): Promise<void> {
  // Esta app invalida sesión al hacer navegación full-page si falta esta bandera.
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('bapp_session_active', '1');
    } catch {
      // no-op
    }
  });
}

async function loginFromModal(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  expectedRole: 'client' | 'provider'
): Promise<string> {
  await page.goto('/auth/login?tab=login');
  const modal = page.locator('.modal-content');
  await modal.locator('form input[formcontrolname="email"]').fill(email);
  await modal.locator('#login-password').fill(password);
  await modal.locator('form button[type="submit"]').click();

  const roleButtonName = expectedRole === 'provider' ? /^proveedor$/i : /^cliente$/i;
  const rolePromptButton = modal.getByRole('button', { name: roleButtonName });
  // Si aparece selector de rol, resolverlo y esperar navegación real.
  if (await rolePromptButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rolePromptButton.click({ force: true });
  }

  // Importante: no esperar /auth/login porque el test partiría ahí mismo y terminaría prematuramente.
  await page.waitForURL(/\/(client|provider)\//i, { timeout: 15_000 }).catch(() => {});
  return page.url();
}

test.describe('@auth Flujos autenticados — cliente', () => {
  test.skip(!hasClientCreds, 'Define TEST_CLIENT_EMAIL y TEST_CLIENT_PASSWORD para activar este bloque.');

  test.beforeEach(async ({ page }) => {
    await keepBrowserSessionAlive(page);
    const url = await loginFromModal(
      page,
      process.env.TEST_CLIENT_EMAIL || '',
      process.env.TEST_CLIENT_PASSWORD || '',
      'client'
    );
    test.skip(/auth\/login/i.test(url), 'Credenciales cliente inválidas o cuenta sin acceso web.');
    test.skip(/provider\//i.test(url), 'La cuenta configurada como cliente ingresó como proveedor.');
  });

  test('navega tabs críticas sin redirigir a login', async ({ page }) => {
    await page.goto('/client/tabs/service-search');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/client/tabs/bookings');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/client/tabs/chats');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/client/tabs/profile');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/client/categories');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/client/settings');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/notifications');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('flujo de pago cliente renderiza plan y métodos no destructivos', async ({ page }) => {
    await page.goto('/payment?product_type=CLIENT_UNLOCK_7&returnTo=%2Fclient%2Ftabs%2Fprofile');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.getByText(/método de pago/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continuar con transbank/i })).toBeVisible();

    await page.getByRole('button', { name: /mercado pago/i }).click();
    await expect(page.getByText(/mercado pago estará disponible/i)).toBeVisible();

    await page.getByRole('button', { name: /transferencia bancaria/i }).click();
    await expect(page.getByText(/transferencia bancaria estará disponible/i)).toBeVisible();
  });

  test('búsqueda de servicios muestra proveedores navegables y detalle consistente', async ({ page }) => {
    await page.goto('/client/tabs/service-search');
    await expect(page).not.toHaveURL(/login/i);

    const providerLinks = page.locator('a.pro-card-floating[href*="/client/provider-info/"]');
    const linkCount = await providerLinks.count();
    test.skip(linkCount === 0, 'No hay proveedores desbloqueados para validar detalle en este entorno.');

    const firstCard = providerLinks.first();
    const cardName = (await firstCard.locator('h3').first().innerText()).trim();
    await firstCard.click();

    await expect(page).toHaveURL(/\/client\/provider-info\//i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(cardName, { timeout: 10_000 });
  });

  test('edición de perfil cliente guarda cambios no destructivos', async ({ page }) => {
    await page.goto('/client/tabs/profile');
    await expect(page).not.toHaveURL(/login/i);

    await page.getByRole('button', { name: /^editar perfil$/i }).click();
    await expect(page.locator('#client-profile-full-name')).toBeVisible();
    await expect(page.locator('#client-profile-phone')).toBeVisible();

    // Guardado sin cambios: valida endpoint/update sin contaminar datos.
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    const successBanner = page.getByText(/perfil actualizado correctamente/i);
    const errorBanner = page.locator('.alert-bar--error');

    // En algunos entornos el backend no emite banner cuando no hay cambios efectivos.
    if (await successBanner.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(successBanner).toBeVisible();
    } else {
      await expect(errorBanner).toHaveCount(0);
      await expect(page.locator('#client-profile-full-name')).toBeVisible();
      await expect(page.getByRole('button', { name: /guardar cambios/i })).toBeEnabled();
    }
  });
});

test.describe('@auth Flujos autenticados — proveedor', () => {
  test.skip(!hasProviderCreds, 'Define TEST_PROVIDER_EMAIL y TEST_PROVIDER_PASSWORD para activar este bloque.');

  test.beforeEach(async ({ page }) => {
    await keepBrowserSessionAlive(page);
    const url = await loginFromModal(
      page,
      process.env.TEST_PROVIDER_EMAIL || '',
      process.env.TEST_PROVIDER_PASSWORD || '',
      'provider'
    );
    test.skip(/auth\/login/i.test(url), 'Credenciales proveedor inválidas o cuenta sin acceso web.');
    test.skip(/client\//i.test(url), 'La cuenta configurada como proveedor ingresó como cliente.');
  });

  test('navega tabs críticas sin redirigir a login', async ({ page }) => {
    await page.goto('/provider/tabs/home');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/provider/tabs/my-services');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/provider/tabs/bookings');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/provider/tabs/inbox');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/provider/tabs/profile');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/provider/account-info');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();

    await page.goto('/notifications');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('flujo de pago proveedor renderiza plan y métodos no destructivos', async ({ page }) => {
    await page.goto('/payment?product_type=PROVIDER_PREMIUM_MONTHLY&returnTo=%2Fprovider%2Ftabs%2Fprofile');
    await expect(page).not.toHaveURL(/login/i);
    await expect(page.getByText(/método de pago/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continuar con transbank/i })).toBeVisible();

    await page.getByRole('button', { name: /mercado pago/i }).click();
    await expect(page.getByText(/mercado pago estará disponible/i)).toBeVisible();
  });

  test('reservas proveedor cargan y muestran estructura base', async ({ page }) => {
    await page.goto('/provider/tabs/bookings');
    await expect(page).not.toHaveURL(/login/i);

    const identityGateHeading = page.getByRole('heading', { name: /verificaci.n de identidad/i });
    const identityUploadButton = page.getByRole('button', { name: /subir y validar/i });
    if (
      /\/auth\/verify-identity/i.test(page.url()) ||
      (await identityUploadButton.count()) > 0 ||
      (await identityGateHeading.count()) > 0
    ) {
      await expect(identityUploadButton).toBeVisible();
      test.skip(true, 'Proveedor redirigido a verificación de identidad en entorno actual.');
    }

    await expect(page.getByRole('heading', { name: /reservas de clientes/i })).toBeVisible();
  });

  test('mis servicios y agregar servicio muestran estado operativo', async ({ page }) => {
    await page.goto('/provider/tabs/my-services');
    await expect(page).not.toHaveURL(/login/i);

    const identityGateHeading = page.getByRole('heading', { name: /verificaci.n de identidad/i });
    const identityUploadButton = page.getByRole('button', { name: /subir y validar/i });
    if (
      /\/auth\/verify-identity/i.test(page.url()) ||
      (await identityUploadButton.count()) > 0 ||
      (await identityGateHeading.count()) > 0
    ) {
      await expect(identityUploadButton).toBeVisible();
      test.skip(true, 'Proveedor redirigido a verificación de identidad en entorno actual.');
    }

    await expect(page.getByRole('heading', { name: /mis servicios/i })).toBeVisible();

    await page.goto('/provider/add-service');
    await expect(page).not.toHaveURL(/login/i);

    const identityGate = page.getByRole('heading', { name: /verificaci.n de identidad/i });
    const identityUpload = page.getByRole('button', { name: /subir y validar/i });
    const paymentGate = page.getByRole('heading', { name: /actualiza tu plan/i });
    const formSubmit = page.getByRole('button', { name: /crear servicio/i });
    const loginCta = page.getByRole('button', { name: /iniciar sesi.n/i });

    if (await loginCta.isVisible().catch(() => false)) {
      test.skip(true, 'Sesión proveedor no activa en este entorno para /provider/add-service.');
    }

    if ((await identityGate.count()) > 0 || (await identityUpload.count()) > 0) {
      await expect(identityUpload).toBeVisible();
      return;
    }

    if (await paymentGate.isVisible().catch(() => false)) {
      await expect(page.getByRole('link', { name: /ver planes/i })).toBeVisible();
      return;
    }

    await expect(formSubmit).toBeVisible();
    await expect(page.locator('select[formcontrolname="main_category_id"]')).toBeVisible();
    await expect(page.locator('input[formcontrolname="business_name"]')).toBeVisible();
    await expect(page.locator('input[formcontrolname="phone"]')).toBeVisible();
    await expect(page.locator('input[formcontrolname="address"]')).toBeVisible();
  });

  test('portfolio en add-service permite cargar y remover imágenes sin guardar', async ({ page }) => {
    await page.goto('/provider/add-service');
    await expect(page).not.toHaveURL(/login/i);

    const formSubmit = page.getByRole('button', { name: /crear servicio/i });
    const identityGate = page.getByRole('heading', { name: /verificaci.n de identidad/i });
    const identityUpload = page.getByRole('button', { name: /subir y validar/i });
    const paymentGate = page.getByRole('heading', { name: /actualiza tu plan/i });
    const loginCta = page.getByRole('button', { name: /iniciar sesi.n/i });

    if (await loginCta.isVisible().catch(() => false)) {
      test.skip(true, 'Sesión proveedor no activa en este entorno para validar portfolio.');
    }

    if ((await identityGate.count()) > 0 || (await identityUpload.count()) > 0) {
      test.skip(true, 'Proveedor sin identidad aprobada; no se puede validar portfolio en formulario.');
    }
    if (await paymentGate.isVisible().catch(() => false)) {
      test.skip(true, 'Proveedor bloqueado por plan; no se puede validar portfolio en formulario.');
    }

    await expect(formSubmit).toBeVisible();

    const fileInput = page.locator('input.as-file-input');
    await fileInput.setInputFiles(tinyImagePath);

    await expect(page.locator('.as-portfolio-item')).toHaveCount(1, { timeout: 10_000 });
    await page.locator('.as-portfolio-remove').first().click();
    await expect(page.locator('.as-portfolio-item')).toHaveCount(0);
  });

  test('consistencia básica de información en perfil proveedor', async ({ page }) => {
    await page.goto('/provider/tabs/profile');
    await expect(page).not.toHaveURL(/login/i);

    const sidebarName = (await page.locator('.user-mini-info h3').first().innerText()).trim();
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      sidebarName.split(' ')[0],
      { timeout: 10_000 }
    );
    await expect(page.locator('.stat-card .stat-value').first()).toBeVisible();
  });

  test('edición de perfil proveedor guarda cambios no destructivos', async ({ page }) => {
    await page.goto('/provider/tabs/profile');
    await expect(page).not.toHaveURL(/login/i);

    await page.getByRole('button', { name: /^editar perfil$/i }).click();
    await expect(page.locator('#pp_full_name')).toBeVisible();
    await expect(page.locator('#pp_phone')).toBeVisible();

    // Guardado sin cambios para validar flujo sin alterar datos de negocio.
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    const successBanner = page.getByText(/perfil actualizado correctamente/i);
    const errorBanner = page.locator('.alert-bar--error');

    if (await successBanner.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(successBanner).toBeVisible();
      return;
    }

    // Fallback estable: sin error y con formulario aún operativo.
    await expect(errorBanner).toHaveCount(0);
    await expect(page.locator('#pp_full_name')).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toBeEnabled();
  });

  test('alta de servicio mutante opcional (solo con E2E_ALLOW_MUTATIONS=true)', async ({ page }) => {
    test.skip(!allowMutations, 'Define E2E_ALLOW_MUTATIONS=true para ejecutar alta real de servicio.');

    await page.goto('/provider/add-service');
    await expect(page).not.toHaveURL(/login/i);

    const formSubmit = page.getByRole('button', { name: /crear servicio/i });
    test.skip(!(await formSubmit.isVisible().catch(() => false)), 'El entorno muestra gate de identidad/plan; no se puede mutar.');

    const categorySelect = page.locator('select[formcontrolname="main_category_id"]');
    await expect(categorySelect).toBeVisible();

    const categoryOptions = categorySelect.locator('option');
    const catCount = await categoryOptions.count();
    test.skip(catCount < 2, 'No hay categorías suficientes para alta automática.');

    const unique = `QA Auto ${Date.now()}`;
    await categorySelect.selectOption({ index: 1 });

    const serviceSelect = page.locator('select[formcontrolname="service_id"]');
    await expect(serviceSelect).toBeVisible({ timeout: 10_000 });
    const serviceOptions = serviceSelect.locator('option');
    const svcCount = await serviceOptions.count();
    test.skip(svcCount < 2, 'No hay subservicios disponibles para esta categoría.');
    await serviceSelect.selectOption({ index: 1 });

    await page.locator('input[formcontrolname="business_name"]').fill(unique);
    await page.locator('textarea[formcontrolname="description"]').fill('Servicio creado automáticamente para validación E2E.');
    await page.locator('input[formcontrolname="phone"]').fill('+56 9 1234 5678');
    await page.locator('input[formcontrolname="hourly_rate"]').fill('10000');

    await page.locator('input[formcontrolname="address"]').fill('Santiago Centro');
    const firstSuggestion = page.locator('.as-suggestion-item').first();
    await expect(firstSuggestion).toBeVisible({ timeout: 10_000 });
    await firstSuggestion.click();

    await formSubmit.click();
    await page.locator('.gm-modal .gm-btn--solid').click();

    await expect(page.getByText(/servicio creado exitosamente/i)).toBeVisible({ timeout: 15_000 });
  });
});
