import { Component, HostListener, inject, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, NavigationError } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StorageService } from './core/services/storage.service';
import { SessionService } from './core/services/session.service';
import { filter } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AppFooterComponent } from './shared/components/app-footer/app-footer.component';
import { GlobalModalComponent } from './shared/components/global-modal/global-modal.component';
import { CompleteProfileModalComponent } from './shared/components/complete-profile-modal/complete-profile-modal.component';
import { ProfileCompletionService } from './core/services/profile-completion.service';
import { AuthService } from './core/services/auth.service';
import { PlatformLanguageService } from './core/services/platform-language.service';
import { PlatformAutoTranslateService } from './core/services/platform-auto-translate.service';
import { TPipe } from './shared/pipes/t.pipe';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AppFooterComponent, GlobalModalComponent, CompleteProfileModalComponent, TPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="app-layout">
      <main
        class="main-content"
        [class.main-content--fullscreen]="isFullscreenRoute()">
        <router-outlet #outlet="outlet"></router-outlet>
      </main>

      @if (showFooter()) {
        <app-footer [compact]="compactFooter()" />
      }
    </div>

    <app-global-modal />

    <!-- Modal completar perfil OAuth -->
    @if (profileCompletion.show()) {
      <app-complete-profile-modal />
    }

    <!-- Modal sesión expirada -->
    @if (session.isExpired()) {
      <div class="se-backdrop" (click)="$event.stopPropagation()">
        <div class="se-modal" (click)="$event.stopPropagation()">
          <div class="se-header">
            <div class="se-icon">
              <ion-icon name="time-outline"></ion-icon>
            </div>
            <h3>{{ 'session.expired.title' | t }}</h3>
          </div>

          <p class="se-message">
            {{ 'session.expired.body' | t }}
          </p>

          <div class="se-actions">
            <button class="se-btn" (click)="goToLogin()">
              {{ 'session.expired.cta' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
    }

    .app-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      /* overflow-x gestionado en body/html para evitar bloquear
         eventos táctiles en iOS Safari durante animaciones de ruta */
    }

    .main-content--fullscreen {
      overflow: hidden;
    }

    .se-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 16px;
    }

    .se-modal {
      width: min(420px, 100%);
      background: #101010;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      animation: se-pop-in 0.2s ease;
    }

    @keyframes se-pop-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .se-header {
      padding: 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(245, 158, 11, 0.14);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .se-icon {
      width: 40px;
      height: 40px;
      background: rgba(245, 158, 11, 0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fbbf24;
      font-size: 24px;
    }

    .se-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #f9fafb;
    }

    .se-message {
      margin: 0;
      padding: 18px;
      color: #cbd5e1;
      line-height: 1.6;
      font-size: 14px;
    }

    .se-actions {
      padding: 0 18px 18px;
      display: flex;
      justify-content: flex-end;
    }

    .se-btn {
      border: none;
      border-radius: 10px;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      background: #fde68a;
      color: #111827;
      transition: background 0.15s ease;
    }

    .se-btn:hover {
      background: #fcd34d;
    }
  `],
})
export class AppComponent implements OnInit {
  private readonly router  = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);
  private readonly platformLanguage = inject(PlatformLanguageService);
  private readonly autoTranslate = inject(PlatformAutoTranslateService);
  readonly session          = inject(SessionService);
  readonly profileCompletion = inject(ProfileCompletionService);

  readonly showFooter = signal(false);
  readonly compactFooter = signal(false);
  readonly isFullscreenRoute = signal(false);
  private hasNavigatedOnInit = false;
  private attemptedCookieBootstrap = false;
  private isBootstrappingAuth = false;

  ngOnInit(): void {
    this.platformLanguage.initialize();
    this.autoTranslate.start();

    const navEntry = globalThis.performance
      .getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

    // Retorno desde un flujo de pago externo (Webpay): restaurar la sesión
    // de la pestaña antes de que enforceBrowserSession() pueda invalidarla.
    if (this.storage.isPaymentRedirectPending()) {
      this.storage.clearPaymentRedirectPending();
      if (this.storage.isAuthenticated()) {
        this.storage.markSessionActive();
      }
    }

    // Mantener sesión en recargas explícitas; en navegación back/forward o nueva,
    // se aplicará el cierre por ausencia de marca de sesión de pestaña.
    if (navEntry?.type === 'reload' && this.storage.isAuthenticated()) {
      this.storage.markSessionActive();
    }

    // Si la app volvió sin sesión de pestaña activa, forzar cierre local.
    this.storage.enforceBrowserSession();

    // Detectar expiración proactiva al recargar la página
    this.session.watchExpiry(this.storage.token());

    // Manejar errores de chunk loading (lazy modules) causados por deploys
    // mientras el usuario tiene una versión anterior cacheada por el SW
    this.router.events.pipe(
      filter(event => event instanceof NavigationError)
    ).subscribe((event: NavigationError) => {
      const isChunkError = /Failed to fetch dynamically imported|Loading chunk|Importing a module script failed/i.test(
        event.error?.message ?? ''
      );
      if (isChunkError) {
        // Hard reload a la URL destino — bypassa la caché del SW
        globalThis.location.href = event.url;
      }
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      const fullscreenRoute = url.includes('/client/tabs/service-map');
      const hideFooter =
        url.startsWith('/auth') ||
        url.includes('/chat/') ||
        fullscreenRoute;
      const useCompactFooter = fullscreenRoute;

      this.showFooter.set(!hideFooter);
      this.compactFooter.set(useCompactFooter);
      this.isFullscreenRoute.set(fullscreenRoute);

      if (!this.hasNavigatedOnInit) {
        this.handleInitialNavigation();
        this.hasNavigatedOnInit = true;
      }
    });
  }

  goToLogin(): void {
    this.session.reset();
    this.router.navigate(['/auth/login']);
  }

  @HostListener('window:pagehide')
  onPageHide(): void {
    // Si vamos a un flujo de pago externo (Webpay) del cual se espera retorno,
    // no invalidar la sesión de la pestaña.
    if (this.storage.isPaymentRedirectPending()) return;

    // Al abandonar la SPA (cerrar, retroceder o cambiar de sitio),
    // invalidamos la marca de sesión de pestaña.
    this.storage.clearBrowserSessionFlag();
  }

  private handleInitialNavigation(): void {
    const currentUrl    = this.router.url;
    const isAuthenticated = this.storage.isAuthenticated();
    const user          = this.storage.user();

    if (currentUrl.startsWith('/auth/') && currentUrl !== '/auth/login') return;

    // Rutas públicas que no requieren autenticación
    const publicRoutes = ['/registro-proveedores', '/proveedores', '/terms', '/privacy', '/faq', '/guest', '/app-payment'];
    if (publicRoutes.some(r => currentUrl.startsWith(r))) return;

    if (!isAuthenticated) {
      if (!this.attemptedCookieBootstrap && !this.isBootstrappingAuth) {
        this.bootstrapSessionFromCookie();
        return;
      }
      if (currentUrl !== '/auth/login') this.router.navigate(['/auth/login']);
      return;
    }

    if (currentUrl === '/' || currentUrl === '/auth/login' || currentUrl.startsWith('/auth')) {
      if (user?.role === 'PROVIDER') {
        this.router.navigate(['/provider/tabs']);
      } else if (user?.role === 'CLIENT') {
        this.router.navigate(['/client/categories']);
      }
    } else if (currentUrl === '/client/tabs' || currentUrl === '/client/tabs/service-search') {
      this.router.navigate(['/client/categories'], { replaceUrl: true });
    }
  }

  private async bootstrapSessionFromCookie(): Promise<void> {
    this.attemptedCookieBootstrap = true;
    this.isBootstrappingAuth = true;
    try {
      const profile = await firstValueFrom(this.auth.fetchProfile());
      this.storage.setUser({
        id: profile.user_id,
        email: profile.email ?? '',
        role: profile.role ?? 'CLIENT',
        status: profile.status ?? 'ACTIVE',
        has_premium: profile.has_premium ?? false,
      });
      this.storage.markSessionActive();
      this.session.reset();
    } catch {
      // Sin cookie de sesión válida o backend no alcanzable.
    } finally {
      this.isBootstrappingAuth = false;
      this.handleInitialNavigation();
    }
  }
}
