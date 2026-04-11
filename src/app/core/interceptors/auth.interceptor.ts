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
  '/auth/register',
  '/auth/google',
  '/auth/facebook',
  '/auth/reset-password',
  '/auth/set-new-password',
  '/auth/verify-email',
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

  if (isExternal(req.url) || isPublic(req.url)) {
    return next(req);
  }

  const token = storage.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshToken$.next(null);

          return auth.refreshToken().pipe(
            switchMap(res => {
              isRefreshing = false;
              refreshToken$.next(res.access_token);
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${res.access_token}` }
              });
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
              const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${t}` } });
              return next(retryReq);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
