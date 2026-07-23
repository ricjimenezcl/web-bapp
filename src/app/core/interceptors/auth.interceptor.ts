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

function isExternal(url: string): boolean {
  return EXTERNAL_DOMAINS.some(d => url.includes(d));
}

function isPublic(url: string): boolean {
  return PUBLIC_PATHS.some(p => url.includes(p));
}

let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

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
              storage.clearSession();
              // Solo mostrar modal si no está ya en login
              if (!router.url.startsWith('/auth/')) {
                session.markExpired();
              } else {
                router.navigate(['/auth/login']);
              }
              return throwError(() => refreshError);
            })
          );
        } else {
          return refreshToken$.pipe(
            filter(t => t !== null),
            take(1),
            switchMap(t => {
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
