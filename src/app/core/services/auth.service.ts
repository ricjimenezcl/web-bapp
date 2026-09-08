import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { ProfileCompletionService } from './profile-completion.service';
import { SessionService } from './session.service';
import {
  UserProfile, StoredUser, LoginRequest, TokenResponse, LoginRolesResponse,
  ClientRegister, ProviderRegister
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http    = inject(HttpClient);
  private readonly router  = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly session = inject(SessionService);
  private readonly profileCompletion = inject(ProfileCompletionService);

  private readonly api = environment.apiUrl;

  readonly isAuthenticated = computed(() => this.storage.isAuthenticated());
  readonly currentUser     = computed(() => this.storage.user());
  readonly currentProfile  = computed(() => this.storage.profile());
  readonly isProvider      = computed(() => this.storage.user()?.role === 'PROVIDER');
  readonly isClient        = computed(() => this.storage.user()?.role === 'CLIENT');

  login(credentials: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.api}/auth/login`, {
      username: credentials.username,
      password: credentials.password,
      role: credentials.role,
    }).pipe(
      tap(res => this._storeSession(res))
    );
  }

  getLoginRoles(email: string): Observable<LoginRolesResponse> {
    return this.http.get<LoginRolesResponse>(`${this.api}/auth/login-roles`, {
      params: { email: email.trim().toLowerCase() }
    });
  }

  loginWithGoogle(idToken: string, role: string = 'CLIENT'): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.api}/auth/oauth/google`, { 
      id_token: idToken,
      role: role 
    })
      .pipe(tap(res => this._storeSession(res)));
  }

  loginWithFacebook(accessToken: string, role: string = 'CLIENT', emailHint?: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.api}/auth/oauth/facebook`, {
      access_token: accessToken,
      role: role,
      email_hint: emailHint?.trim().toLowerCase() || undefined,
    })
      .pipe(tap(res => this._storeSession(res)));
  }

  registerClient(data: ClientRegister): Observable<any> {
    return this.http.post(`${this.api}/auth/register-client`, {
      ...data,
      registration_source: 'web',
    });
  }

  registerProvider(data: ProviderRegister): Observable<any> {
    return this.http.post(`${this.api}/auth/register-provider`, {
      ...data,
      registration_source: 'web',
    });
  }

  resetPassword(email: string): Observable<any> {
    return this.http.post(`${this.api}/auth/reset-password`, { email });
  }

  setNewPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.api}/auth/set-new-password`, { token, new_password: newPassword });
  }

  sendVerificationEmail(email: string, source: 'web' | 'mobile' = 'web'): Observable<any> {
    return this.http.post(`${this.api}/auth/send-verification-email`, {
      email: email.trim().toLowerCase(),
      source,
    });
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.api}/auth/verify-email`, { params: { token } });
  }

  fetchProfile(): Observable<UserProfile> {
    return this.http.get<any>(`${this.api}/users/me`).pipe(
      map(res => {
        const p = res.profile ?? {};
        return {
          id:         p.id         ?? res.id,
          user_id:    p.user_id    ?? res.id,
          full_name:  p.full_name  ?? '',
          has_premium: p.has_premium ?? res.has_premium ?? false,
          phone:      p.phone      ?? undefined,
          avatar:     p.avatar     ?? undefined,
          bio:        p.bio        ?? undefined,
          rating_avg: p.rating_avg ?? undefined,
          email:      res.email    ?? undefined,
          role:       res.role     ?? undefined,
          status:     res.status   ?? undefined,
          run:        p.run        ?? undefined,
          created_at: res.created_at ?? undefined,
        } as UserProfile;
      }),
      tap(profile => {
        this.storage.setProfile(profile);
        const user = this.storage.user();
        if (user) {
          this.storage.setUser({
            ...user,
            role: profile.role ?? user.role,
            status: profile.status ?? user.status,
            email: profile.email ?? user.email,
            has_premium: profile.has_premium ?? user.has_premium,
          });
        }
      })
    );
  }

  logout(): void {
    const refreshToken = this.storage.getRefreshToken();
    this.http.post(`${this.api}/auth/logout`, {
      refresh_token: refreshToken || undefined,
    }).subscribe({ error: () => {} });
    this.profileCompletion.reset();
    this.storage.clearSession();
    this.router.navigate(['/auth/login']);
  }

  refreshToken(): Observable<TokenResponse> {
    const refreshToken = this.storage.getRefreshToken();
    return this.http.post<TokenResponse>(`${this.api}/auth/refresh`, {
      refresh_token: refreshToken || undefined,
    }).pipe(
      tap(res => {
        // Evita dejar un modal/timer de sesión expirada activo tras un refresh exitoso.
        this.session.reset();
        // Programar expiración proactiva del nuevo access token (cookie-first: no se persiste en localStorage).
        this.session.watchExpiry(res.access_token);
        // Cookie-first: evitar persistir access token en localStorage.
        this.storage.clearToken();
        if (res.refresh_token) {
          this.storage.setRefreshToken(res.refresh_token);
        }
      })
    );
  }

  acceptTerms(emailOptIn: boolean): Observable<any> {
    return this.http.patch(`${this.api}/auth/accept-terms`, { email_opt_in: emailOptIn }).pipe(
      tap(() => {
        const user = this.storage.user();
        if (user) this.storage.setUser({ ...user });
      })
    );
  }

  getToken(): string | null {
    return this.storage.token();
  }

  navigateAfterLogin(role: string, status: string): void {
    console.log('🚀 navigateAfterLogin - Role:', role, 'Status:', status);
    if (role === 'PROVIDER') {
      // Siempre entra al dashboard; providerVerificationGuard bloquea rutas que requieren identidad validada
      console.log('📍 Navegando a: /provider/tabs');
      this.router.navigate(['/provider/tabs'], { replaceUrl: true });
    } else {
      console.log('📍 Navegando a: /client/categories');
      this.router.navigate(['/client/categories'], { replaceUrl: true });
    }
  }

  private _storeSession(res: TokenResponse): void {
    // Limpia cualquier estado/timer previo de expiración para evitar cierres falsos.
    this.session.reset();
    // Programar expiración proactiva del access token (cookie-first: no se persiste en localStorage).
    this.session.watchExpiry(res.access_token);

    // Cookie-first: backend fija el access token en cookie HttpOnly.
    this.storage.clearToken();
    if (res.refresh_token) {
      this.storage.setRefreshToken(res.refresh_token);
    }
    this.storage.markSessionActive();
    const stored: StoredUser = {
      id:          res.user_id,
      email:       '',
      role:        res.role,
      status:      res.status,
      provider_id: res.provider_id,
      client_id:   res.client_id,
    };
    this.storage.setUser(stored);
  }
}
