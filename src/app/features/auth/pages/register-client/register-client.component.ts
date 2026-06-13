import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';

function passwordMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pass    = ctrl.get('password');
  const confirm = ctrl.get('confirmPassword');
  if (!pass || !confirm) return null;
  return pass.value === confirm.value ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register-client.component.html',
})
export class RegisterClientComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading  = signal(false);
  error    = signal('');
  success  = signal(false);
  showPass = signal(false);

  form = this.fb.group({
    full_name:       ['', [Validators.required, Validators.minLength(3)]],
    email:           ['', [Validators.required, Validators.email]],
    phone:           ['', [Validators.required, CustomValidators.phone()]],
    password:        ['', [Validators.required, Validators.minLength(8), CustomValidators.passwordComplexity()]],
    confirmPassword: ['', Validators.required],
    terms_accepted:  [false, Validators.requiredTrue],
  }, { validators: passwordMatch });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { full_name, email, phone, password, terms_accepted } = this.form.value;
    this.auth.registerClient({ full_name: full_name!, email: email!, phone: phone!, password: password!, terms_accepted: !!terms_accepted }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail;
        if (Array.isArray(detail) && detail.length > 0) {
          this.error.set(detail[0]?.msg ?? 'Error al registrarse. Verifica los datos.');
          return;
        }
        this.error.set(detail ?? 'Error al registrarse. Inténtalo de nuevo.');
      }
    });
  }

  get f() { return this.form.controls; }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanPhone(input.value);
    input.value = formatted;
    this.form.get('phone')?.setValue(formatted, { emitEvent: false });
  }
}
