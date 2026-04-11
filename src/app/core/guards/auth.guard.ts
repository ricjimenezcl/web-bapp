import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StorageService } from '../services/storage.service';

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
    return user.status !== 'ACTIVE'
      ? router.createUrlTree(['/auth/verify-identity'])
      : router.createUrlTree(['/provider/tabs']);
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
  const user = storage.user();
  if (!user) return router.createUrlTree(['/auth/login']);
  if (user.role === 'PROVIDER' && user.status !== 'ACTIVE') {
    return router.createUrlTree(['/auth/verify-identity']);
  }
  return true;
};
