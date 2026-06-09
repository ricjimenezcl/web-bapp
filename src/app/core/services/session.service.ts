import { Injectable, signal } from '@angular/core';

/**
 * Servicio global que gestiona el estado de expiración de sesión.
 * El interceptor lo llama cuando el refresh token falla (401 en /auth/refresh).
 * También detecta proactivamente la expiración del JWT mediante un timer.
 * AppComponent lo escucha y muestra el modal de sesión expirada.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly isExpired = signal(false);
  private _expiryTimer: ReturnType<typeof setTimeout> | null = null;

  markExpired(): void {
    this._clearTimer();
    this.isExpired.set(true);
  }

  reset(): void {
    this._clearTimer();
    this.isExpired.set(false);
  }

  /**
   * Decodifica el JWT y programa un setTimeout para llamar a markExpired()
   * exactamente cuando el token expire. Debe llamarse cada vez que se emita
   * un nuevo access_token (login, refresh) y al recargar la app.
   */
  watchExpiry(token: string | null): void {
    this._clearTimer();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp: number | undefined = payload['exp'];
      if (!exp) return;

      const msUntilExpiry = exp * 1000 - Date.now();

      // Si ya expiró, no bloqueamos aquí: el interceptor se encargará
      // de hacer el refresh cuando se realice la primera petición HTTP.
      if (msUntilExpiry <= 0) return;

      this._expiryTimer = setTimeout(() => this.markExpired(), msUntilExpiry);
    } catch {
      // JWT malformado — no hacer nada; el interceptor lo atrapará al vuelo
    }
  }

  private _clearTimer(): void {
    if (this._expiryTimer !== null) {
      clearTimeout(this._expiryTimer);
      this._expiryTimer = null;
    }
  }
}
