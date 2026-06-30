import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ProfileCompletionService } from '../../../core/services/profile-completion.service';
import { StorageService } from '../../../core/services/storage.service';
import { CustomValidators } from '../../validators/custom-validators';
import { formatChileanPhone, formatChileanRUT } from '../../utils/form-formatters';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-complete-profile-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './complete-profile-modal.component.html',
  styleUrl: './complete-profile-modal.component.scss',
})
export class CompleteProfileModalComponent {
  private readonly fb          = inject(FormBuilder);
  private readonly http        = inject(HttpClient);
  private readonly completion  = inject(ProfileCompletionService);
  private readonly storage     = inject(StorageService);
  private readonly api         = environment.apiUrl;

  readonly loading = signal(false);
  readonly error   = signal('');

  /** true cuando el rol activo es PROVIDER (necesita RUT) */
  readonly needsRut = computed(() => this.completion.role() === 'PROVIDER');

  readonly form = this.fb.group({
    phone: ['', [Validators.required, CustomValidators.phone()]],
    run:   [''],
  });

  constructor() {
    // Activar validación de RUT cuando el rol es PROVIDER
    this.form.get('run')!.setValidators(
      this.needsRut() ? [Validators.required, CustomValidators.rut()] : []
    );
    this.form.get('run')!.updateValueAndValidity();
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanPhone(input.value);
    this.form.get('phone')?.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanRUT(input.value);
    this.form.get('run')?.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const v = this.form.value;
    const phone = v.phone ?? '';

    // Enviar teléfono sin el prefijo visual para el backend
    const cleanPhone = phone.replace(/\D/g, '');
    const payload: Record<string, string> = { phone: cleanPhone };

    if (this.needsRut()) {
      // El backend espera RUT sin puntos: "12345678-9"
      payload['run'] = (v.run ?? '').replace(/\./g, '');
    }

    const endpoint = this.needsRut()
      ? `${this.api}/providers/me`
      : `${this.api}/clients/me`;

    this.http.patch(endpoint, payload).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        // Actualizar perfil en storage
        const current = this.storage.profile();
        if (current) {
          this.storage.setProfile({ ...current, phone: cleanPhone, run: payload['run'] });
        }
        // Persistir en localStorage: no volver a preguntar en próximos logins
        const userId = this.storage.user()?.id;
        if (userId) localStorage.setItem(`bapp_profile_ok_${userId}`, '1');
        this.completion.dismiss();
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.error.set(detail);
        } else if (Array.isArray(detail)) {
          this.error.set(detail.map((d: any) => d.msg ?? d).join('. '));
        } else {
          this.error.set('Error al guardar los datos. Por favor intenta de nuevo.');
        }
      }
    });
  }
}
