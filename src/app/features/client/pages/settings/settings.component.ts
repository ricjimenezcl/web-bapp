import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ProfileService } from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PlatformLanguage, PlatformLanguageService } from '../../../../core/services/platform-language.service';
import { TPipe } from '../../../../shared/pipes/t.pipe';
import { ModalService } from '../../../../core/services/modal.service';
import { DEFAULT_AVATAR_URL } from '../../../../core/constants/default-avatar';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TPipe],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private fb         = inject(FormBuilder);
  private profileSvc = inject(ProfileService);
  private auth       = inject(AuthService);
  private router     = inject(Router);
  private readonly platformLanguage = inject(PlatformLanguageService);
  private readonly modal = inject(ModalService);

  readonly languages: Array<{ value: PlatformLanguage; labelKey: string }> = [
    { value: 'es', labelKey: 'lang.es' },
    { value: 'en', labelKey: 'lang.en' },
    { value: 'pt', labelKey: 'lang.pt' },
  ];
  readonly selectedLanguage = this.platformLanguage.language;

  pwLoading = signal(false);
  pwError   = signal('');
  pwSuccess = signal(false);

  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  pwForm = this.fb.group({
    old_password:     ['', Validators.required],
    new_password:     ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  }, { validators: this._matchPasswords });

  getAvatarSrc(): string {
    const profile = this.auth.currentProfile();
    return profile?.avatar || profile?.avatar_url || profile?.picture || DEFAULT_AVATAR_URL;
  }

  handleAvatarError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (!image) return;
    if (image.dataset['fallbackApplied'] === 'true' || image.src === DEFAULT_AVATAR_URL) {
      image.style.display = 'none';
      return;
    }
    image.dataset['fallbackApplied'] = 'true';
    image.src = DEFAULT_AVATAR_URL;
  }

  togglePasswordVisibility(field: 'old' | 'new' | 'confirm'): void {
    if (field === 'old') {
      this.showOldPassword = !this.showOldPassword;
      return;
    }
    if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
      return;
    }
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async changePassword(): Promise<void> {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }
    const { old_password, new_password } = this.pwForm.value;

    if (new_password !== this.pwForm.get('confirm_password')?.value) {
      this.pwError.set('Las contraseñas no coinciden.'); return;
    }

    const confirmed = await this.modal.confirm(
      '¿Deseas cambiar tu contraseña? Deberás iniciar sesión nuevamente.',
      'Confirmar cambio de contraseña',
      'Cambiar'
    );
    if (!confirmed) return;

    this.pwLoading.set(true);
    this.pwError.set('');
    this.profileSvc.changePassword(old_password!, new_password!).subscribe({
      next: async () => {
        this.pwLoading.set(false);
        this.pwSuccess.set(true);
        this.pwForm.reset();
        await this.modal.success('Tu contraseña se cambió correctamente. Inicia sesión nuevamente.', 'Contraseña actualizada');
        this.auth.logout();
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

  onLanguageChange(value: string): void {
    if (value === 'es' || value === 'en' || value === 'pt') {
      this.platformLanguage.setLanguage(value);
    }
  }

  private _matchPasswords(group: any) {
    const pw  = group.get('new_password')?.value;
    const cpw = group.get('confirm_password')?.value;
    return pw === cpw ? null : { mismatch: true };
  }
}
