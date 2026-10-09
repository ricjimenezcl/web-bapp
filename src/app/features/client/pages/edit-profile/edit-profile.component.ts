import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DEFAULT_AVATAR_URL } from '../../../../core/constants/default-avatar';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ProfileService } from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ContentFilterService } from '../../../../shared/services/content-filter.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { offensiveContentAsyncValidator } from '../../../../shared/validators/content-filter.validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';
import { ModalService } from '../../../../core/services/modal.service';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  private readonly fb      = inject(FormBuilder);
  private readonly profile = inject(ProfileService);
  readonly auth            = inject(AuthService);
  private readonly router  = inject(Router);
  private readonly contentFilterService = inject(ContentFilterService);
  private readonly modal   = inject(ModalService);

  loading      = signal(false);
  error        = signal('');
  success      = signal(false);
  avatarPreview = signal<string | null>(null);
  private avatarFile: File | null = null;

  form = this.fb.group({
    full_name: ['', {
      validators: [Validators.required, Validators.minLength(3)],
      asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'profile')],
      updateOn: 'change',
    }],
    phone:     ['', CustomValidators.phone()],
    bio:       ['', {
      asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'profile')],
      updateOn: 'change',
    }],
  });

  ngOnInit(): void {
    const p = this.auth.currentProfile();
    if (p) {
      this.form.patchValue({ full_name: p.full_name, phone: p.phone, bio: p.bio });
      if (p.avatar) this.avatarPreview.set(p.avatar);
    }
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanPhone(input.value);
    input.value = formatted;
    this.form.get('phone')?.setValue(formatted, { emitEvent: false });
  }

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

  onAvatarChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = e => this.avatarPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.form.pending) { this.form.markAllAsTouched(); return; }

    const confirmed = await this.modal.confirm(
      '¿Deseas guardar los cambios en tu perfil?',
      'Confirmar cambios',
      'Guardar'
    );
    if (!confirmed) return;

    this.loading.set(true);
    this.error.set('');

    const save = () => {
      this.profile.updateMe(this.form.value as any).subscribe({
        next: async () => {
          this.loading.set(false);
          this.success.set(true);
          setTimeout(() => this.success.set(false), 3000);
          await this.modal.success('Tu perfil se actualizó correctamente.', 'Perfil actualizado');
        },
        error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail ?? 'Error al actualizar.'); }
      });
    };

    if (this.avatarFile) {
      this.profile.uploadAvatar(this.avatarFile).subscribe({
        next: (res) => { this.form.patchValue({ ...(this.form.value as any), avatar: res.avatar_url }); save(); },
        error: () => save()
      });
    } else {
      save();
    }
  }
}
