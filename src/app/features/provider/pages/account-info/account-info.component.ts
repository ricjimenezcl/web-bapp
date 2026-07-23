import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProfileService } from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-account-info',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  styles: [`
    :host { display: block; background: #000; min-height: 100vh; }

    .ai-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .ai-back {
      display: inline-flex; align-items: center; gap: 8px;
      color: #94A3B8; font-size: 13px; font-weight: 500;
      text-decoration: none; margin-bottom: 28px;
      transition: color 0.15s;
      background: none; border: none; cursor: pointer; font-family: inherit;
      &:hover { color: #F9FAFB; }
      svg { width: 16px; height: 16px; }
    }

    .ai-header {
      margin-bottom: 32px;
      h1 { font-size: 26px; font-weight: 700; color: #F9FAFB; margin: 0 0 6px; }
      p  { font-size: 14px; color: #94A3B8; margin: 0; }
    }

    .ai-card {
      background: #0E0E0E;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .ai-card-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 10px;
    }

    .ai-email-value {
      font-size: 15px; font-weight: 500; color: #F9FAFB;
    }

    .ai-card-title {
      font-size: 16px; font-weight: 600; color: #F9FAFB;
      margin: 0 0 20px;
    }

    .ai-form-group {
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;
      label { font-size: 12px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; }
      input {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; padding: 11px 14px;
        font-size: 14px; color: #F9FAFB; outline: none;
        transition: border-color 0.15s; font-family: inherit;
        &::placeholder { color: #94A3B8; }
        &:focus { border-color: rgba(253,230,138,0.5); }
        &.is-error { border-color: rgba(252,165,165,0.6); }
      }
    }

    .ai-form-error {
      font-size: 11px; color: #FCA5A5;
    }

    .ai-password-wrap {
      position: relative;
      input { padding-right: 42px; }
    }

    .ai-eye-btn {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      color: #94A3B8;
      cursor: pointer;
      padding: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      svg { width: 18px; height: 18px; }
    }

    .ai-btn-primary {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 12px 20px;
      background: #FDE68A; color: #0a0a0a;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
      cursor: pointer; transition: opacity 0.15s; font-family: inherit;
      margin-top: 8px;
      &:hover { opacity: 0.9; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .ai-spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: #0a0a0a;
      border-radius: 50%; animation: aiSpin 0.7s linear infinite;
    }
    @keyframes aiSpin { to { transform: rotate(360deg); } }

    .ai-alert {
      display: flex; align-items: center; gap: 10px;
      padding: 13px 16px; border-radius: 12px; font-size: 14px;
      font-weight: 500; margin-bottom: 16px;
      svg { width: 18px; height: 18px; flex-shrink: 0; }
      &--success { background: rgba(167,243,208,0.08); border: 1px solid rgba(167,243,208,0.25); color: #A7F3D0; }
      &--error   { background: rgba(252,165,165,0.08); border: 1px solid rgba(252,165,165,0.25); color: #FCA5A5; }
    }

    @media (max-width: 640px) {
      .ai-container { padding: 20px 16px; }
    }
  `],
  template: `
    <div class="ai-container">
      <a routerLink="/provider/tabs/profile" class="ai-back">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        Volver al perfil
      </a>

      <div class="ai-header">
        <h1>Información de cuenta</h1>
        <p>Gestiona tu correo y contraseña</p>
      </div>

      @if (success()) {
        <div class="ai-alert ai-alert--success">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          Contraseña actualizada correctamente
        </div>
      }
      @if (error()) {
        <div class="ai-alert ai-alert--error">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {{ error() }}
        </div>
      }

      <div class="ai-card">
        <p class="ai-card-label">Correo electrónico</p>
        <p class="ai-email-value">{{ auth.currentProfile()?.email ?? 'No disponible' }}</p>
      </div>

      <div class="ai-card">
        <h3 class="ai-card-title">Cambiar contraseña</h3>
        <form [formGroup]="form" (ngSubmit)="changePassword()">
          <div class="ai-form-group">
            <label for="old_pw">Contraseña actual</label>
            <div class="ai-password-wrap">
              <input id="old_pw" [type]="showOldPassword ? 'text' : 'password'" formControlName="old_password" placeholder="••••••••"
                [class.is-error]="form.get('old_password')!.invalid && form.get('old_password')!.touched">
              <button
                type="button"
                class="ai-eye-btn"
                (click)="togglePasswordVisibility('old')"
                [attr.aria-label]="showOldPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                @if (showOldPassword) {
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-10-7a17.856 17.856 0 012.366-3.357M6.228 6.228A9.956 9.956 0 0112 5c5 0 9 4 10 7a17.87 17.87 0 01-4.293 5.774M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 9L3 3"/></svg>
                } @else {
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
            @if (form.get('old_password')!.invalid && form.get('old_password')!.touched) {
              <span class="ai-form-error">La contraseña actual es requerida</span>
            }
          </div>
          <div class="ai-form-group">
            <label for="new_pw">Nueva contraseña</label>
            <div class="ai-password-wrap">
              <input id="new_pw" [type]="showNewPassword ? 'text' : 'password'" formControlName="new_password" placeholder="Mínimo 8 caracteres"
                [class.is-error]="form.get('new_password')!.invalid && form.get('new_password')!.touched">
              <button
                type="button"
                class="ai-eye-btn"
                (click)="togglePasswordVisibility('new')"
                [attr.aria-label]="showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                @if (showNewPassword) {
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-10-7a17.856 17.856 0 012.366-3.357M6.228 6.228A9.956 9.956 0 0112 5c5 0 9 4 10 7a17.87 17.87 0 01-4.293 5.774M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 9L3 3"/></svg>
                } @else {
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
            @if (form.get('new_password')!.invalid && form.get('new_password')!.touched) {
              <span class="ai-form-error">
                {{ form.get('new_password')!.errors?.['required'] ? 'La nueva contraseña es requerida' : 'Mínimo 8 caracteres' }}
              </span>
            }
          </div>
          <button type="submit" class="ai-btn-primary" [disabled]="loading()">
            @if (loading()) { <span class="ai-spinner"></span> }
            Actualizar contraseña
          </button>
        </form>
      </div>
    </div>
  `
})
export class AccountInfoComponent {
  readonly auth = inject(AuthService);
  private readonly profileSvc = inject(ProfileService);
  private readonly fb = inject(FormBuilder);

  loading = signal(false);
  error   = signal('');
  success = signal(false);

  showOldPassword = false;
  showNewPassword = false;

  form = this.fb.group({
    old_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8)]],
  });

  togglePasswordVisibility(field: 'old' | 'new'): void {
    if (field === 'old') {
      this.showOldPassword = !this.showOldPassword;
      return;
    }
    this.showNewPassword = !this.showNewPassword;
  }

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
