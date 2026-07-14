import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { UserProfile } from '../../../../core/models/user.model';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';
import { ProductType } from '../../../../core/services/payment.service';
import { ModalService } from '../../../../core/services/modal.service';

export type DashView = 'overview' | 'edit' | 'purchases' | 'config' | 'help';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './client-profile.component.html',
  styleUrl: './client-profile.component.scss',
})
export class ClientProfileComponent implements OnInit {
  private readonly auth    = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router  = inject(Router);
  private readonly route   = inject(ActivatedRoute);
  private readonly fb      = inject(FormBuilder);
  private readonly modal   = inject(ModalService);

  // ── Profile ────────────────────────────────────────────────────────
  user    = signal<UserProfile | null>(null);
  loading = signal(true);

  // ── Active view ────────────────────────────────────────────────────
  activeView = signal<DashView>('overview');

  // ── Edit profile ───────────────────────────────────────────────────
  editLoading  = signal(false);
  editError    = signal('');
  editSuccess  = signal(false);
  paymentSuccess = signal(false);
  avatarPreview = signal<string | null>(null);
  private avatarFile: File | null = null;

  form = this.fb.group({
    full_name: ['', [Validators.required, Validators.minLength(3)]],
    phone:     ['', CustomValidators.phone()],
    bio:       [''],
  });

  // ── Settings ───────────────────────────────────────────────────────
  darkMode  = signal(false);
  pwLoading = signal(false);
  pwError   = signal('');
  pwSuccess = signal(false);
  showPremiumModal = signal(false);

  pwForm = this.fb.group({
    old_password:     ['', Validators.required],
    new_password:     ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  }, { validators: this._matchPasswords });

  // ──────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Detectar si el pago fue exitoso
    this.route.queryParamMap.subscribe(params => {
      if (params.has('paymentSuccess')) {
        this.paymentSuccess.set(true);
        // Limpiar el queryParam después de 5 segundos
        setTimeout(() => this.paymentSuccess.set(false), 5000);
        // Remover el queryParam de la URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { paymentSuccess: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }).catch(() => {}); // Ignorar errores de navegación
      }
    });

    const stored = this.auth.currentProfile();
    if (stored) {
      this.user.set(stored);
      this.loading.set(false);
      this._patchForm(stored);
    }
    this.profile.getMe().subscribe({
      next: (p) => { this.user.set(p); this.loading.set(false); this._patchForm(p); },
      error: ()  => this.loading.set(false),
    });
    this.darkMode.set(document.documentElement.classList.contains('dark'));
  }

  // ── View switching ─────────────────────────────────────────────────
  showView(view: DashView): void {
    this.activeView.set(view);
    this.editError.set('');
    this.editSuccess.set(false);
    this.pwError.set('');
    this.pwSuccess.set(false);
  }

  // ── Edit profile ───────────────────────────────────────────────────
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fmt   = formatChileanPhone(input.value);
    input.value = fmt;
    this.form.get('phone')?.setValue(fmt, { emitEvent: false });
  }

  onAvatarChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = e => this.avatarPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  submitProfile(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.editLoading.set(true);
    this.editError.set('');

    const save = () => {
      this.profile.updateMe(this.form.value as any).subscribe({
        next: () => {
          this.editLoading.set(false);
          this.editSuccess.set(true);
          setTimeout(() => this.editSuccess.set(false), 3000);
        },
        error: (err) => {
          this.editLoading.set(false);
          this.editError.set(err?.error?.detail ?? 'Error al actualizar.');
        },
      });
    };

    if (this.avatarFile) {
      this.profile.uploadAvatar(this.avatarFile).subscribe({
        next: (res) => { this.form.patchValue({ ...(this.form.value as any), avatar: res.avatar_url }); save(); },
        error: ()   => save(),
      });
    } else {
      save();
    }
  }

  // ── Settings ───────────────────────────────────────────────────────
  toggleDarkMode(enabled: boolean): void {
    this.darkMode.set(enabled);
    document.documentElement.classList.toggle('dark', enabled);
    localStorage.setItem('theme', enabled ? 'dark' : 'light');
  }

  changePassword(): void {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }
    const { old_password, new_password } = this.pwForm.value;
    if (new_password !== this.pwForm.get('confirm_password')?.value) {
      this.pwError.set('Las contraseñas no coinciden.'); return;
    }
    this.pwLoading.set(true);
    this.pwError.set('');
    this.profile.changePassword(old_password!, new_password!).subscribe({
      next: () => {
        this.pwLoading.set(false);
        this.pwSuccess.set(true);
        this.pwForm.reset();
        setTimeout(() => this.auth.logout(), 2000);
      },
      error: (err) => {
        this.pwLoading.set(false);
        this.pwError.set(err?.error?.detail ?? 'Error al cambiar la contraseña.');
      },
    });
  }

  // ── External ───────────────────────────────────────────────────────
  goToPayment(productType: ProductType = 'CLIENT_UNLOCK_30'): void {
    this.router.navigate(['/payment'], {
      queryParams: {
        product_type: productType,
        returnTo: '/client/tabs/profile'
      }
    });
  }

  openPremiumModal(): void { this.showPremiumModal.set(true); }
  closePremiumModal(): void { this.showPremiumModal.set(false); }
  choosePremiumPlan(productType: ProductType): void {
    this.closePremiumModal();
    this.goToPayment(productType);
  }
  goToPrivacy(): void { this.router.navigate(['/privacy']); }
  goToTerms():   void { this.router.navigate(['/terms']); }

  async inviteFriends(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user?.id) return;
    const inviteUrl = `https://bapp.app/invite/${user.id}`;
    const shareData = { title: 'Únete a BAPP', text: 'Descarga BAPP y encuentra los mejores servicios cerca de ti.', url: inviteUrl };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        await this.modal.success('Enlace copiado al portapapeles.');
      }
      catch {
        await this.modal.error('No se pudo copiar el enlace.');
      }
    }
  }

  async goLogout(): Promise<void> {
    const confirmed = await this.modal.confirm(
      '¿Estás seguro de que deseas cerrar sesión?',
      'Cerrar sesión',
      'Cerrar sesión'
    );

    if (confirmed) {
      this.auth.logout();
      this.router.navigate(['/auth/login']);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────
  private _patchForm(p: UserProfile): void {
    this.form.patchValue({ full_name: p.full_name, phone: p.phone ?? '', bio: p.bio ?? '' });
    if (p.avatar) this.avatarPreview.set(p.avatar);
  }

  private _matchPasswords(group: any) {
    const pw  = group.get('new_password')?.value;
    const cpw = group.get('confirm_password')?.value;
    return pw === cpw ? null : { mismatch: true };
  }
}
