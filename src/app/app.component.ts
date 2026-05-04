import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StorageService } from './core/services/storage.service';
import { SessionService } from './core/services/session.service';
import { filter } from 'rxjs';
import { fadeAnimation } from './core/animations/route-animations';
import { AppFooterComponent } from './shared/components/app-footer/app-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AppFooterComponent],
  animations: [fadeAnimation],
  template: `
    <div [@fadeAnimation]="getRouteAnimationData()">
      <router-outlet #outlet="outlet"></router-outlet>
    </div>

    @if (showFooter()) {
      <app-footer />
    }

    <!-- Modal sesión expirada -->
    @if (session.isExpired()) {
      <div class="session-expired-backdrop" (click)="$event.stopPropagation()">
        <div class="session-expired-modal">
          <div class="session-expired-icon">🔒</div>
          <h2 class="session-expired-title">Sesión expirada</h2>
          <p class="session-expired-msg">
            Tu sesión ha finalizado por inactividad.<br>
            Por favor, inicia sesión nuevamente.
          </p>
          <button class="session-expired-btn" (click)="goToLogin()">
            Iniciar sesión
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .session-expired-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
    }

    .session-expired-modal {
      background: #fff;
      border-radius: 1rem;
      padding: 2rem 1.5rem;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      animation: modal-in 0.25s ease;
    }

    @keyframes modal-in {
      from { opacity: 0; transform: scale(0.92) translateY(12px); }
      to   { opacity: 1; transform: scale(1)   translateY(0);     }
    }

    .session-expired-icon {
      font-size: 3rem;
      margin-bottom: 0.75rem;
    }

    .session-expired-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }

    .session-expired-msg {
      font-size: 0.9rem;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .session-expired-btn {
      display: inline-block;
      width: 100%;
      padding: 0.75rem 1.5rem;
      background: #2563eb;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 600;
      border: none;
      border-radius: 0.625rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .session-expired-btn:hover {
      background: #1d4ed8;
    }
  `],
})
export class AppComponent implements OnInit {
  private readonly router  = inject(Router);
  private readonly storage = inject(StorageService);
  readonly session         = inject(SessionService);

  readonly showFooter = signal(false);
  private hasNavigatedOnInit = false;

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      this.showFooter.set(!url.startsWith('/auth') && !url.includes('/chat/'));

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

  getRouteAnimationData(): string {
    return this.router.url;
  }

  private handleInitialNavigation(): void {
    const currentUrl    = this.router.url;
    const isAuthenticated = this.storage.isAuthenticated();
    const user          = this.storage.user();

    if (currentUrl.startsWith('/auth/') && currentUrl !== '/auth/login') return;

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
