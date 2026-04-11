import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

function passwordMatch(ctrl: AbstractControl): ValidationErrors | null {
  const p = ctrl.get('password'), c = ctrl.get('confirmPassword');
  return p && c && p.value !== c.value ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-set-new-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-700 to-primary-800 flex items-center justify-center p-4">
      <div class="w-full max-w-md animate-fade-in">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-white">Nueva contraseña</h1>
        </div>
        @if (success()) {
          <div class="card card-body text-center">
            <div class="text-5xl mb-4">✅</div>
            <h3 class="text-lg font-semibold">¡Contraseña actualizada!</h3>
            <a routerLink="/auth/login" class="btn btn-primary btn-block mt-4">Iniciar sesión</a>
          </div>
        } @else {
          <div class="card card-body shadow-card-lg">
            @if (error()) { <div class="alert alert-danger mb-4"><span>{{ error() }}</span></div> }
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              <div class="form-group">
                <label class="form-label">Nueva contraseña</label>
                <input type="password" formControlName="password" class="form-input"
                  [class.error]="form.get('password')!.invalid && form.get('password')!.touched"
                  placeholder="Mínimo 8 caracteres">
                @if (form.get('password')!.invalid && form.get('password')!.touched) {
                  <span class="form-error">
                    {{ form.get('password')!.errors?.['required'] ? 'La contraseña es requerida' : 'Mínimo 8 caracteres' }}
                  </span>
                }
              </div>
              <div class="form-group">
                <label class="form-label">Confirmar contraseña</label>
                <input type="password" formControlName="confirmPassword" class="form-input">
                @if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')!.touched) {
                  <span class="form-error">Las contraseñas no coinciden</span>
                }
              </div>
              <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span> }
                Actualizar contraseña
              </button>
            </form>
          </div>
        }
      </div>
    </div>
  `
})
export class SetNewPasswordComponent implements OnInit {
  private fb    = inject(FormBuilder);
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private token = '';

  loading = signal(false);
  error   = signal('');
  success = signal(false);

  form = this.fb.group({
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatch });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error.set('Token inválido o expirado.');
  }

  submit(): void {
    if (this.form.invalid || !this.token) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.auth.setNewPassword(this.token, this.form.value.password!).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail ?? 'Error al actualizar.'); }
    });
  }
}
