import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone, formatChileanRUT } from '../../../../shared/utils/form-formatters';

function passwordMatch(ctrl: AbstractControl): ValidationErrors | null {
  const p = ctrl.get('password'), c = ctrl.get('confirmPassword');
  if (!p || !c) return null;
  return p.value === c.value ? null : { passwordMismatch: true };
}


@Component({
  selector: 'app-register-provider',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register-provider.component.html',
})
export class RegisterProviderComponent {
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
    run:             ['', CustomValidators.rut()],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    terms_accepted:  [false, Validators.requiredTrue],
  }, { validators: passwordMatch });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const v = this.form.value;
    this.auth.registerProvider({
      full_name:      v.full_name!,
      email:          v.email!,
      phone:          v.phone!,
      password:       v.password!,
      terms_accepted: !!v.terms_accepted,
      run:            v.run || undefined,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Error al registrarse. Inténtalo de nuevo.');
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

  onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanRUT(input.value);
    input.value = formatted;
    this.form.get('run')?.setValue(formatted, { emitEvent: false });
  }
}
