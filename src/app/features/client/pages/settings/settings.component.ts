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
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
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

  showOldPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

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
