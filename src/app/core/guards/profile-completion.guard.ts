import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { ProfileCompletionService } from '../services/profile-completion.service';
import { environment } from '../../../environments/environment';

const LS_KEY = (id: number) => `bapp_profile_ok_${id}`;

/**
 * Guard que verifica si el perfil del usuario está completo.
 * - PROVIDER: usa /providers/me (is_profile_complete = run AND phone)
 * - CLIENT  : usa /users/me  (profile.phone)
 * Persiste en localStorage para no re-preguntar en logins futuros del mismo usuario.
 */
export const profileCompletionGuard: CanActivateFn = () => {
  const http       = inject(HttpClient);
  const storage    = inject(StorageService);
  const completion = inject(ProfileCompletionService);
  const api        = environment.apiUrl;

  if (completion.checked) return true;

  const user = storage.user();
  const role = user?.role as 'CLIENT' | 'PROVIDER' | undefined;
  if (!role) return true;

  // Completado previamente (sobrevive logout / re-login del mismo usuario)
  if (user?.id && localStorage.getItem(LS_KEY(user.id))) {
    completion.markChecked();
    return true;
  }

  if (role === 'PROVIDER') {
    return http.get<any>(`${api}/providers/me`).pipe(
      map(res => {
        if (res.is_profile_complete === true) {
          completion.markChecked();
          if (user?.id) localStorage.setItem(LS_KEY(user.id), '1');
        } else {
          completion.require('PROVIDER');
        }
        return true;
      }),
      catchError(() => { completion.markChecked(); return of(true); })
    );
  }

  const cached = storage.profile();
  if (cached) {
    if (!cached.phone) {
      completion.require('CLIENT');
    } else {
      completion.markChecked();
      if (user?.id) localStorage.setItem(LS_KEY(user.id), '1');
    }
    return true;
  }

  return http.get<any>(`${api}/users/me`).pipe(
    map(res => {
      const phone = res.profile?.phone;
      if (!phone) {
        completion.require('CLIENT');
      } else {
        completion.markChecked();
        if (user?.id) localStorage.setItem(LS_KEY(user.id), '1');
      }
      return true;
    }),
    catchError(() => { completion.markChecked(); return of(true); })
  );
};
