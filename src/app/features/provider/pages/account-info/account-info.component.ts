import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProfileService } from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-account-info',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="min-h-full bg-surface-50">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a routerLink="/provider/tabs/profile" class="p-2 -ml-2 text-slate-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Información de cuenta</h1>
      </header>
      <div class="p-4 space-y-4">
        @if (success()) { <div class="alert alert-success">✅ Contraseña actualizada</div> }
        @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

        <div class="card card-body">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Correo electrónico</h3>
          <p class="text-sm text-slate-700">{{ auth.currentProfile()?.email ?? 'No disponible' }}</p>
        </div>

        <div class="card card-body space-y-4">
          <h3 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Cambiar contraseña</h3>
          <form [formGroup]="form" (ngSubmit)="changePassword()" class="space-y-3">
            <div class="form-group">
              <label class="form-label">Contraseña actual</label>
              <input type="password" formControlName="old_password" class="form-input"
                [class.error]="form.get('old_password')!.invalid && form.get('old_password')!.touched">
              @if (form.get('old_password')!.invalid && form.get('old_password')!.touched) {
                <span class="form-error">La contraseña actual es requerida</span>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Nueva contraseña</label>
              <input type="password" formControlName="new_password" class="form-input"
                [class.error]="form.get('new_password')!.invalid && form.get('new_password')!.touched">
              @if (form.get('new_password')!.invalid && form.get('new_password')!.touched) {
                <span class="form-error">
                  {{ form.get('new_password')!.errors?.['required'] ? 'La nueva contraseña es requerida' : 'Mínimo 8 caracteres' }}
                </span>
              }
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
              @if (loading()) { <span class="spinner"></span> }
              Actualizar contraseña
            </button>
          </form>
        </div>
      </div>
    </div>
  `
})
export class AccountInfoComponent {
  readonly auth = inject(AuthService);
  private profileSvc = inject(ProfileService);
  private fb = inject(FormBuilder);

  loading = signal(false);
  error   = signal('');
  success = signal(false);

  form = this.fb.group({
    old_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
  });

  changePassword(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const { old_password, new_password } = this.form.value;
    this.profileSvc.changePassword(old_password!, new_password!).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); this.form.reset(); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail ?? 'Error al cambiar contraseña.'); }
    });
  }
}
