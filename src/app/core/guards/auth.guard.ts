import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { environment } from '../../../environments/environment';

export const authGuard: CanActivateFn = () => {
  const storage = inject(StorageService);
  const router  = inject(Router);
  if (storage.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login']);
};

export const noAuthGuard: CanActivateFn = () => {
  const storage = inject(StorageService);
  const router  = inject(Router);
  if (!storage.isAuthenticated()) return true;
  const user = storage.user();
  if (user?.role === 'PROVIDER') {
    // Siempre redirige al dashboard; providerVerificationGuard bloquea rutas que requieren identidad validada
    return router.createUrlTree(['/provider/tabs']);
  }
  return router.createUrlTree(['/client/tabs']);
};

export const clientGuard: CanActivateFn = () => {
  const storage = inject(StorageService);
  const router  = inject(Router);
  if (storage.user()?.role === 'CLIENT') return true;
  return router.createUrlTree(['/auth/login']);
};

export const providerGuard: CanActivateFn = () => {
  const storage = inject(StorageService);
  const router  = inject(Router);
  if (storage.user()?.role === 'PROVIDER') return true;
  return router.createUrlTree(['/auth/login']);
};

export const providerVerificationGuard: CanActivateFn = () => {
  const storage = inject(StorageService);
  const router  = inject(Router);
  const http    = inject(HttpClient);
  const api     = environment.apiUrl;
  const user = storage.user();

  if (!user) return router.createUrlTree(['/auth/login']);

  if (user.role !== 'PROVIDER') {
    return router.createUrlTree(['/auth/login']);
  }

  return http.get<{ status: string }>(`${api}/providers/validation/status`).pipe(
    map((res) => {
      const status = String(res?.status ?? '').toLowerCase();
      return status === 'approved' ? true : router.createUrlTree(['/auth/verify-identity']);
    }),
    catchError(() => {
      // Fallback legacy: usar estado del usuario en storage si falla la verificación remota.
      if (user.status !== 'ACTIVE') {
        return of(router.createUrlTree(['/auth/verify-identity']));
      }
      return of(true);
    })
  );
};
