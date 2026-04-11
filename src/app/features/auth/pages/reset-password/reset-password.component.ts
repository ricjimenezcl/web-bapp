import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-700 to-primary-800 flex items-center justify-center p-4">
      <div class="w-full max-w-md animate-fade-in">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-white">Recuperar contraseña</h1>
          <p class="text-primary-200 mt-1">Te enviaremos un enlace a tu correo</p>
        </div>
        @if (success()) {
          <div class="card card-body text-center">
            <div class="text-5xl mb-4">📧</div>
            <h3 class="text-lg font-semibold text-slate-800">Correo enviado</h3>
            <p class="text-slate-600 mt-2">Revisa tu bandeja de entrada y sigue las instrucciones.</p>
            <a routerLink="/auth/login" class="btn btn-primary btn-block mt-4">Ir al inicio de sesión</a>
          </div>
        } @else {
          <div class="card card-body shadow-card-lg">
            @if (error()) { <div class="alert alert-danger mb-4"><span>{{ error() }}</span></div> }
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              <div class="form-group">
                <label class="form-label">Correo electrónico</label>
                <input type="email" formControlName="email" class="form-input" placeholder="tu@email.com">
                @if (form.get('email')!.invalid && form.get('email')!.touched) {
                  <span class="form-error">Ingresa un correo válido</span>
                }
              </div>
              <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span> }
                Enviar enlace
              </button>
            </form>
            <div class="mt-4 text-center">
              <a routerLink="/auth/login" class="text-sm text-primary-600 font-medium">Volver al login</a>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  loading = signal(false);
  error   = signal('');
  success = signal(false);
  form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.auth.resetPassword(this.form.value.email!).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail ?? 'Error al enviar el correo.'); }
    });
  }
}
