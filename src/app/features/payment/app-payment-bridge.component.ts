import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../core/services/storage.service';
import { environment } from '../../../environments/environment';
import { StoredUser } from '../../core/models/user.model';

/**
 * AppPaymentBridgeComponent
 *
 * Ruta: /app-payment  (sin authGuard)
 *
 * Recibe desde la app móvil:
 *   ?token=JWT&product_type=X&user_id=Y&role=Z&returnTo=bapp://...
 *
 * Flujo:
 *   1. Lee token y params de la URL
 *   2. Intercambia token por cookies HttpOnly con /auth/web-session
 *   3. Guarda usuario en StorageService (sin persistir access token)
 *   4. Redirige a /payment con los params del producto
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:sans-serif;">
      <div *ngIf="!error">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFD60A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p style="color:#555;margin-top:8px;">Preparando tu pago...</p>
      </div>
      <div *ngIf="error" style="text-align:center">
        <p style="color:#e53e3e;font-size:16px;">{{ error }}</p>
        <a href="/auth/login" style="color:#FFD60A;margin-top:12px;display:inline-block;">Iniciar sesión</a>
      </div>
    </div>
    <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
  `
})
export class AppPaymentBridgeComponent implements OnInit {
  private readonly route   = inject(ActivatedRoute);
  private readonly router  = inject(Router);
  private readonly http    = inject(HttpClient);
  private readonly storage = inject(StorageService);

  error: string | null = null;

  ngOnInit(): void {
    const params     = this.route.snapshot.queryParamMap;
    const token      = params.get('token');
    const productType = params.get('product_type');
    const returnTo   = params.get('returnTo');

    // Remover token sensible del URL para no dejarlo en historial/referrer.
    this.stripSensitiveQueryParams();

    if (!token) {
      this.error = 'Enlace de pago inválido. Por favor vuelve a intentarlo desde la app.';
      return;
    }

    // Intercambiar token por sesión web basada en cookies HttpOnly
    this.http.post<any>(`${environment.apiUrl}/auth/web-session`, { token }).subscribe({
      next: (res) => {
        const userData = res?.user;
        if (!userData) {
          this.error = 'No fue posible iniciar la sesión web. Intenta nuevamente.';
          return;
        }

        this.storage.clearToken();
        const user: StoredUser = {
          id:          userData.id,
          email:       userData.email,
          role:        userData.role,
          status:      userData.status ?? 'ACTIVE',
          provider_id: userData.provider_id,
          client_id:   userData.client_id,
          has_premium: userData.has_premium ?? false,
        };
        this.storage.setUser(user);
        this.storage.markSessionActive();

        // Construir query params para /payment
        const paymentParams: Record<string, string> = {};
        if (productType) paymentParams['product_type'] = productType;
        if (returnTo)    paymentParams['returnTo']     = returnTo;

        this.router.navigate(['/payment'], { queryParams: paymentParams });
      },
      error: () => {
        this.error = 'Tu sesión ha expirado. Por favor vuelve a la app e inténtalo de nuevo.';
      }
    });
  }

  private stripSensitiveQueryParams(): void {
    try {
      const currentUrl = new URL(globalThis.location.href);
      currentUrl.searchParams.delete('token');
      currentUrl.searchParams.delete('user_id');
      currentUrl.searchParams.delete('role');
      globalThis.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`);
    } catch {
      // Si URL API no está disponible por entorno, continuar sin bloquear el flujo.
    }
  }
}
