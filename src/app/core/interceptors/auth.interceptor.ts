import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, BehaviorSubject, switchMap, filter, take } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

const EXTERNAL_DOMAINS = [
  'photon.komoot.io',
  'nominatim.openstreetmap.org',
  'api.geoapify.com',
  'maps.geoapify.com',
  'tiles.openfreemap.org',
  'api.cloudinary.com',
  'res.cloudinary.com',
];

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/login-roles',
  '/auth/register',
  '/auth/oauth/google',
  '/auth/oauth/facebook',
  '/auth/reset-password',
  '/auth/set-new-password',
  '/auth/send-verification-email',
  '/auth/verify-email',
  '/auth/web-session',
  '/categories/',
];

const REFRESH_FAILED_SENTINEL = '__refresh_failed__';
const REFRESH_RETRY_LATER_SENTINEL = '__refresh_retry_later__';
const REFRESH_RATE_LIMIT_COOLDOWN_MS = 60_000;
const REFRESH_TRANSIENT_COOLDOWN_MS = 5_000;

function shouldExpireSessionOnRefreshFailure(error: unknown): boolean {
  const status = (error as HttpErrorResponse | undefined)?.status;
  return status === 401 || status === 403;
}

function isExternal(url: string): boolean {
  return EXTERNAL_DOMAINS.some(d => url.includes(d));
}

function isPublic(url: string): boolean {
  return PUBLIC_PATHS.some(p => url.includes(p));
}

let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);
let refreshBlockedUntil = 0;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const storage  = inject(StorageService);
  const auth     = inject(AuthService);
  const router   = inject(Router);
  const session  = inject(SessionService);

  if (isExternal(req.url)) {
    return next(req);
  }

  const reqWithCredentials = req.clone({ withCredentials: true });

  if (isPublic(req.url)) {
    return next(reqWithCredentials);
  }

  const token = storage.token();
  const authReq = token
    ? reqWithCredentials.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : reqWithCredentials;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        const hasLocalSession = storage.isAuthenticated() || !!storage.getRefreshToken();
        if (!hasLocalSession) {
          return throwError(() => error);
        }

        // Evita tormentas de refresh cuando el backend aplica rate limit.
        if (Date.now() < refreshBlockedUntil) {
          return throwError(() => error);
        }

        if (!isRefreshing) {
          isRefreshing = true;
          refreshToken$.next(null);

          return auth.refreshToken().pipe(
            switchMap(res => {
              isRefreshing = false;
              refreshToken$.next(res.access_token ?? 'cookie-session');
              const retryReq = res.access_token
                ? reqWithCredentials.clone({
                    setHeaders: { Authorization: `Bearer ${res.access_token}` }
                  })
                : reqWithCredentials;
              return next(retryReq);
            }),
            catchError(refreshError => {
              isRefreshing = false;
                const refreshStatus = (refreshError as HttpErrorResponse | undefined)?.status;
              if (shouldExpireSessionOnRefreshFailure(refreshError)) {
                refreshToken$.next(REFRESH_FAILED_SENTINEL);
                storage.clearSession();
                // Solo mostrar modal si no está ya en login
                if (!router.url.startsWith('/auth/')) {
                  session.markExpired();
                } else {
                  router.navigate(['/auth/login']);
                }
              } else {
                // Errores transitorios (429/red/5xx): no cerrar sesión.
                  refreshBlockedUntil = Date.now() + (refreshStatus === 429
                    ? REFRESH_RATE_LIMIT_COOLDOWN_MS
                    : REFRESH_TRANSIENT_COOLDOWN_MS);
                refreshToken$.next(REFRESH_RETRY_LATER_SENTINEL);
              }
              return throwError(() => refreshError);
            })
          );
        } else {
          return refreshToken$.pipe(
            filter(t => t !== null),
            take(1),
            switchMap(t => {
              if (t === REFRESH_FAILED_SENTINEL || t === REFRESH_RETRY_LATER_SENTINEL) {
                return throwError(() => error);
              }

              const retryReq = t && t !== 'cookie-session'
                ? reqWithCredentials.clone({ setHeaders: { Authorization: `Bearer ${t}` } })
                : reqWithCredentials;
              return next(retryReq);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
