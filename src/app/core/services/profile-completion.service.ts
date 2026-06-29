import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProfileCompletionService {
  /** true mientras el modal de completar perfil esté activo */
  readonly show  = signal(false);
  readonly role  = signal<'CLIENT' | 'PROVIDER'>('CLIENT');

  /** true si el guard ya realizó la verificación en esta sesión */
  private _checked = false;

  get checked(): boolean { return this._checked; }

  require(role: 'CLIENT' | 'PROVIDER'): void {
    this.role.set(role);
    this.show.set(true);
  }

  dismiss(): void {
    this.show.set(false);
    this._checked = true;
  }

  /** Marca la verificación como completada (sin mostrar modal) */
  markChecked(): void {
    this._checked = true;
  }

  /** Reinicia el estado — llamar al hacer logout */
  reset(): void {
    this._checked = false;
    this.show.set(false);
  }
}
