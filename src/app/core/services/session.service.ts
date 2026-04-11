import { Injectable, signal } from '@angular/core';

/**
 * Servicio global que gestiona el estado de expiración de sesión.
 * El interceptor lo llama cuando el refresh token falla (401 en /auth/refresh).
 * AppComponent lo escucha y muestra el modal de sesión expirada.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly isExpired = signal(false);

  markExpired(): void {
    this.isExpired.set(true);
  }

  reset(): void {
    this.isExpired.set(false);
  }
}
