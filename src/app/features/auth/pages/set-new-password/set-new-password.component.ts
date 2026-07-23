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
  templateUrl: './set-new-password.component.html',
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

  showPassword = false;
  showConfirmPassword = false;

  form = this.fb.group({
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatch });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error.set('Token inválido o expirado.');
  }

  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
      return;
    }
    this.showConfirmPassword = !this.showConfirmPassword;
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
