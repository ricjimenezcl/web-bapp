import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { ProfileCompletionService } from '../services/profile-completion.service';

/**
 * Guard que verifica si el perfil del usuario está completo (teléfono y RUT
 * para proveedores). Se ejecuta UNA SOLA VEZ por sesión en las rutas de
 * cliente y proveedor. Si faltan datos, activa el modal de bloqueo.
 *
 * Siempre retorna `true` — no bloquea la navegación; el modal lo hace.
 */
export const profileCompletionGuard: CanActivateFn = () => {
  const auth       = inject(AuthService);
  const storage    = inject(StorageService);
  const completion = inject(ProfileCompletionService);

  // Ya se verificó en esta sesión — no repetir
  if (completion.checked) return true;

  const role = storage.user()?.role as 'CLIENT' | 'PROVIDER' | undefined;
  if (!role) return true;

  // Si el perfil ya está en storage, verificar sin HTTP
  const cached = storage.profile();
  if (cached) {
    const missingPhone = !cached.phone;
    const missingRut   = role === 'PROVIDER' && !cached.run;
    if (missingPhone || missingRut) {
      completion.require(role);
    } else {
      completion.markChecked();
    }
    return true;
  }

  // Perfil no está en storage — hacer fetch (primera carga tras OAuth)
  return auth.fetchProfile().pipe(
    map(profile => {
      const missingPhone = !profile.phone;
      const missingRut   = role === 'PROVIDER' && !profile.run;
      if (missingPhone || missingRut) {
        completion.require(role);
      } else {
        completion.markChecked();
      }
      return true;
    }),
    catchError(() => {
      // Si el endpoint falla, no bloquear al usuario
      completion.markChecked();
      return of(true);
    })
  );
};
