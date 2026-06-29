import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProfileCompletionService {
  /** true mientras el modal de completar perfil esté activo */
  readonly show  = signal(false);
  readonly role  = signal<'CLIENT' | 'PROVIDER'>('CLIENT');

  require(role: 'CLIENT' | 'PROVIDER'): void {
    this.role.set(role);
    this.show.set(true);
  }

  dismiss(): void {
    this.show.set(false);
  }
}
