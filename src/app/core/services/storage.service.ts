import { Injectable, signal, computed } from '@angular/core';
import { StoredUser, UserProfile } from '../models/user.model';

const KEYS = {
  TOKEN:   'bapp_token',
  REFRESH_TOKEN: 'bapp_refresh_token',
  USER:    'bapp_user',
  PROFILE: 'bapp_profile',
} as const;

const SESSION_FLAG = 'bapp_session_active';
const PAYMENT_REDIRECT_FLAG = 'bapp_payment_redirect_pending';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly _token   = signal<string | null>(localStorage.getItem(KEYS.TOKEN));
  private readonly _user    = signal<StoredUser | null>(this._parseJson(localStorage.getItem(KEYS.USER)));
  private readonly _profile = signal<UserProfile | null>(this._parseJson(localStorage.getItem(KEYS.PROFILE)));

  readonly token          = this._token.asReadonly();
  readonly user           = this._user.asReadonly();
  readonly profile        = this._profile.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());

  constructor() {
    // Retorno desde un flujo de pago externo (Webpay): restaurar la marca
    // de sesión de la pestaña antes de que cualquier guard evalúe
    // isAuthenticated(), independientemente del orden de inicialización
    // entre el Router y AppComponent.
    if (sessionStorage.getItem(PAYMENT_REDIRECT_FLAG) === '1') {
      sessionStorage.removeItem(PAYMENT_REDIRECT_FLAG);
      if (this._user()) {
        sessionStorage.setItem(SESSION_FLAG, '1');
      }
    }
  }

  setToken(token: string): void {
    localStorage.setItem(KEYS.TOKEN, token);
    this._token.set(token);
  }

  clearToken(): void {
    localStorage.removeItem(KEYS.TOKEN);
    this._token.set(null);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(KEYS.REFRESH_TOKEN, token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(KEYS.REFRESH_TOKEN);
  }

  setUser(user: StoredUser): void {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    this._user.set(user);
  }

  setProfile(profile: UserProfile): void {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
    this._profile.set(profile);
  }

  updateProfile(partial: Partial<UserProfile>): void {
    const current = this._profile();
    if (current) {
      const updated = { ...current, ...partial };
      this.setProfile(updated);
    }
  }

  /** Marca la sesión como activa en la pestaña actual (se borra al cerrar el browser). */
  markSessionActive(): void {
    sessionStorage.setItem(SESSION_FLAG, '1');
  }

  /** Devuelve true si el usuario inició sesión en esta ventana del browser. */
  isBrowserSessionActive(): boolean {
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  }

  /**
   * Invalida la marca de sesión de esta pestaña.
   * Se usa al abandonar la página para forzar relogin al volver.
   */
  clearBrowserSessionFlag(): void {
    sessionStorage.removeItem(SESSION_FLAG);
  }

  /**
   * Marca que la pestaña está a punto de redirigir a un flujo externo
   * (ej. Webpay) del cual se espera un retorno. Evita que el listener
   * de pagehide invalide la sesión durante esa navegación externa.
   */
  markPaymentRedirectPending(): void {
    sessionStorage.setItem(PAYMENT_REDIRECT_FLAG, '1');
  }

  /** Devuelve true si hay un retorno de pago externo (Webpay) pendiente. */
  isPaymentRedirectPending(): boolean {
    return sessionStorage.getItem(PAYMENT_REDIRECT_FLAG) === '1';
  }

  /** Limpia la marca de retorno de pago pendiente. */
  clearPaymentRedirectPending(): void {
    sessionStorage.removeItem(PAYMENT_REDIRECT_FLAG);
  }

  /**
   * Si hay credenciales persistidas pero no existe marca de sesión activa
   * para la pestaña actual, limpia la sesión por seguridad.
   */
  enforceBrowserSession(): void {
    const hasPersistedAuth = !!this._user();
    if (hasPersistedAuth && !this.isBrowserSessionActive()) {
      this.clearSession();
    }
  }

  clearSession(): void {
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.REFRESH_TOKEN);
    localStorage.removeItem(KEYS.USER);
    localStorage.removeItem(KEYS.PROFILE);
    sessionStorage.removeItem(SESSION_FLAG);
    this._token.set(null);
    this._user.set(null);
    this._profile.set(null);
  }

  private _parseJson<T>(raw: string | null): T | null {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; }
    catch { return null; }
  }
}
