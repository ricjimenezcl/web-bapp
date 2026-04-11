import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ProfileService } from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50">
      <!-- Header -->
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a routerLink="/client/tabs/profile" class="p-2 -ml-2 text-slate-600 hover:text-slate-800 hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <h1 class="text-base font-semibold text-slate-800 flex-1">Configuración</h1>
      </header>

      <div class="p-4 space-y-4">

        <!-- Apariencia -->
        <div class="card">
          <div class="px-4 py-3 border-b border-surface-100">
            <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Apariencia</h2>
          </div>
          <div class="flex items-center justify-between px-4 py-3.5">
            <div class="flex items-center gap-3">
              <span class="text-xl">🌙</span>
              <span class="text-sm font-medium text-slate-700">Modo oscuro</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" [checked]="darkMode()"
                (change)="toggleDarkMode(($any($event.target)).checked)">
              <div class="w-9 h-5 bg-surface-200 peer-checked:bg-primary-600 rounded-full transition-colors
                after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
                after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
            </label>
          </div>
        </div>

        <!-- Cambiar contraseña -->
        <div class="card card-body space-y-4">
          <h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cambiar contraseña</h2>

          @if (pwSuccess()) { <div class="alert alert-success">✅ Contraseña actualizada. Por favor, inicia sesión de nuevo.</div> }
          @if (pwError()) { <div class="alert alert-danger">{{ pwError() }}</div> }

          <form [formGroup]="pwForm" (ngSubmit)="changePassword()" class="space-y-3">
            <div class="form-group">
              <label class="form-label">Contraseña actual</label>
              <input type="password" formControlName="old_password" class="form-input" placeholder="••••••••">
            </div>
            <div class="form-group">
              <label class="form-label">Nueva contraseña</label>
              <input type="password" formControlName="new_password" class="form-input" placeholder="Mínimo 8 caracteres">
              @if (pwForm.get('new_password')?.touched && pwForm.get('new_password')?.errors?.['minlength']) {
                <p class="form-error">Mínimo 8 caracteres</p>
              }
            </div>
            <div class="form-group">
              <label class="form-label">Confirmar nueva contraseña</label>
              <input type="password" formControlName="confirm_password" class="form-input" placeholder="Repite la contraseña">
              @if (pwForm.errors?.['mismatch'] && pwForm.get('confirm_password')?.touched) {
                <p class="form-error">Las contraseñas no coinciden</p>
              }
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="pwLoading()">
              @if (pwLoading()) { <span class="spinner"></span> }
              Actualizar contraseña
            </button>
          </form>
        </div>

        <!-- Legal -->
        <div class="card">
          <a routerLink="/terms" class="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors">
            <span class="text-lg">📄</span>
            <span class="flex-1 text-sm font-medium text-slate-700">Términos y condiciones</span>
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
          <div class="h-px bg-surface-100"></div>
          <a routerLink="/privacy" class="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors">
            <span class="text-lg">🔒</span>
            <span class="flex-1 text-sm font-medium text-slate-700">Política de privacidad</span>
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        <!-- Cerrar sesión -->
        <button (click)="logout()" class="btn btn-danger btn-block">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a2 2 0 01-2-2V7a2 2 0 012-2h4a3 3 0 013 3v1"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private fb         = inject(FormBuilder);
  private profileSvc = inject(ProfileService);
  private auth       = inject(AuthService);
  private router     = inject(Router);

  darkMode  = signal(false);
  pwLoading = signal(false);
  pwError   = signal('');
  pwSuccess = signal(false);

  pwForm = this.fb.group({
    old_password:     ['', Validators.required],
    new_password:     ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  }, { validators: this._matchPasswords });

  ngOnInit(): void {
    this.darkMode.set(document.documentElement.classList.contains('dark'));
  }

  toggleDarkMode(enabled: boolean): void {
    this.darkMode.set(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  changePassword(): void {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }
    const { old_password, new_password } = this.pwForm.value;

    if (new_password !== this.pwForm.get('confirm_password')?.value) {
      this.pwError.set('Las contraseñas no coinciden.'); return;
    }

    this.pwLoading.set(true);
    this.pwError.set('');
    this.profileSvc.changePassword(old_password!, new_password!).subscribe({
      next: () => {
        this.pwLoading.set(false);
        this.pwSuccess.set(true);
        this.pwForm.reset();
        setTimeout(() => { this.auth.logout(); }, 2000);
      },
      error: (err) => {
        this.pwLoading.set(false);
        this.pwError.set(err?.error?.detail ?? 'Error al cambiar la contraseña.');
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }

  private _matchPasswords(group: any) {
    const pw  = group.get('new_password')?.value;
    const cpw = group.get('confirm_password')?.value;
    return pw === cpw ? null : { mismatch: true };
  }
}
