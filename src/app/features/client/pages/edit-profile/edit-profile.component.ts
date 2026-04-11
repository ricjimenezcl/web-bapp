import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ProfileService } from '../../../../core/services/profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a routerLink="/client/tabs/profile" class="p-2 -ml-2 text-slate-600 hover:text-slate-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <h1 class="text-base font-semibold text-slate-800 flex-1">Editar perfil</h1>
        <button type="submit" form="editForm" class="text-sm font-semibold text-primary-600" [disabled]="loading()">
          @if (loading()) { <span class="spinner w-4 h-4"></span> } @else { Guardar }
        </button>
      </header>

      <form id="editForm" [formGroup]="form" (ngSubmit)="submit()" class="p-4 space-y-4">
        @if (success()) { <div class="alert alert-success"><span>✅ Perfil actualizado</span></div> }
        @if (error()) { <div class="alert alert-danger"><span>{{ error() }}</span></div> }

        <!-- Avatar upload -->
        <div class="flex flex-col items-center py-4">
          <div class="relative">
            @if (avatarPreview()) {
              <img [src]="avatarPreview()!" class="avatar w-20 h-20" alt="Avatar">
            } @else {
              <div class="w-20 h-20 rounded-full bg-surface-200 flex items-center justify-center text-3xl">👤</div>
            }
            <label class="absolute bottom-0 right-0 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer shadow">
              <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <input type="file" class="hidden" accept="image/*" (change)="onAvatarChange($event)">
            </label>
          </div>
        </div>

        <div class="card card-body space-y-4">
          <div class="form-group">
            <label class="form-label">Nombre completo *</label>
            <input type="text" formControlName="full_name" class="form-input"
              [class.error]="form.get('full_name')!.invalid && form.get('full_name')!.touched"
              placeholder="Juan Pérez">
            @if (form.get('full_name')!.invalid && form.get('full_name')!.touched) {
              <span class="form-error">
                {{ form.get('full_name')!.errors?.['required'] ? 'El nombre es requerido' : 'Mínimo 3 caracteres' }}
              </span>
            }
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input type="tel" formControlName="phone" class="form-input"
              [class.error]="form.get('phone')!.invalid && form.get('phone')!.touched"
              placeholder="+56 9 XXXX XXXX"
              maxlength="17"
              (input)="onPhoneInput($event)">
            @if (form.get('phone')!.invalid && form.get('phone')!.touched) {
              <span class="form-error">Formato inválido. Ej: +56 9 1234 5678</span>
            }
          </div>
          <div class="form-group">
            <label class="form-label">Biografía</label>
            <textarea formControlName="bio" rows="3" class="form-textarea" placeholder="Cuéntanos sobre ti..."></textarea>
          </div>
        </div>
      </form>
    </div>
  `
})
export class EditProfileComponent implements OnInit {
  private fb      = inject(FormBuilder);
  private profile = inject(ProfileService);
  private auth    = inject(AuthService);
  private router  = inject(Router);

  loading      = signal(false);
  error        = signal('');
  success      = signal(false);
  avatarPreview = signal<string | null>(null);
  private avatarFile: File | null = null;

  form = this.fb.group({
    full_name: ['', [Validators.required, Validators.minLength(3)]],
    phone:     ['', CustomValidators.phone()],
    bio:       [''],
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

  onAvatarChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = e => this.avatarPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const save = () => {
      this.profile.updateMe(this.form.value as any).subscribe({
        next: () => { this.loading.set(false); this.success.set(true); setTimeout(() => this.success.set(false), 3000); },
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
