import { Component, inject, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StorageService } from './core/services/storage.service';
import { SessionService } from './core/services/session.service';
import { filter } from 'rxjs';
import { AppFooterComponent } from './shared/components/app-footer/app-footer.component';
import { GlobalModalComponent } from './shared/components/global-modal/global-modal.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AppFooterComponent, GlobalModalComponent],
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

    <!-- Modal sesión expirada -->
    @if (session.isExpired()) {
      <div class="se-backdrop" (click)="$event.stopPropagation()">
        <div class="se-modal" (click)="$event.stopPropagation()">
          <div class="se-header">
            <div class="se-icon">
              <ion-icon name="time-outline"></ion-icon>
            </div>
            <h3>Sesión expirada</h3>
          </div>

          <p class="se-message">
            Tu sesión ha finalizado por inactividad. Por favor, inicia sesión nuevamente para continuar.
          </p>

          <div class="se-actions">
            <button class="se-btn" (click)="goToLogin()">
              Iniciar sesión
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
  readonly session         = inject(SessionService);

  readonly showFooter = signal(false);
  readonly compactFooter = signal(false);
  readonly isFullscreenRoute = signal(false);
  private hasNavigatedOnInit = false;

  ngOnInit(): void {
    // Detectar expiración proactiva al recargar la página
    this.session.watchExpiry(this.storage.token());

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

  private handleInitialNavigation(): void {
    const currentUrl    = this.router.url;
    const isAuthenticated = this.storage.isAuthenticated();
    const user          = this.storage.user();

    if (currentUrl.startsWith('/auth/') && currentUrl !== '/auth/login') return;

    // Si hay credenciales guardadas pero el browser fue cerrado y reabierto
    // (sessionStorage vacío), se fuerza el re-login
    if (isAuthenticated && !this.storage.isBrowserSessionActive()) {
      this.storage.clearSession();
      this.router.navigate(['/auth/login']);
      return;
    }

    if (!isAuthenticated) {
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
}
