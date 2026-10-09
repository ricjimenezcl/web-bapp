import { Component, inject, signal, computed, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DEFAULT_AVATAR_URL } from '../../../../core/constants/default-avatar';
import { RouterLink, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, filter } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { ProviderProfile } from '../../../../core/models/provider.model';
import { normalizeChileanPhoneForBackend } from '../../../../shared/utils/form-formatters';
import { environment } from '../../../../../environments/environment';
import { ContentFilterService } from '../../../../shared/services/content-filter.service';
import { offensiveContentAsyncValidator } from '../../../../shared/validators/content-filter.validators';
import { TPipe } from '../../../../shared/pipes/t.pipe';
import { PlatformI18nService } from '../../../../core/services/platform-i18n.service';
import { ModalService } from '../../../../core/services/modal.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { parseUtcDate } from '../../../../shared/utils/date-utils';

interface ServiceTransaction {
  id: number;
  amount: number;
  currency: string;
  status: string;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  product: {
    name: string;
    description: string;
    duration_days: number;
    price_clp: number;
  } | null;
}

type ProviderProductType = 'PROVIDER_PLAN_MONTHLY' | 'PROVIDER_PLAN_7D' | 'PROVIDER_PLAN_ANNUAL';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TPipe],
  templateUrl: './provider-profile.component.html',
  styleUrl: './provider-profile.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProviderProfileComponent implements OnInit, OnDestroy {
  private readonly providerSvc = inject(ProviderService);
  private readonly auth        = inject(AuthService);
  private readonly profileSvc  = inject(ProfileService);
  private readonly http        = inject(HttpClient);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);
  private readonly fb          = inject(FormBuilder);
  private readonly contentFilterService = inject(ContentFilterService);
  private readonly i18n        = inject(PlatformI18nService);
  private readonly modal       = inject(ModalService);
  private readonly paymentSvc  = inject(PaymentService);
  private sub?: Subscription;

  provider    = signal<ProviderProfile | null>(null);
  loading     = signal(true);
  activeView  = signal<string>('overview');
  saveLoading = signal(false);
  error       = signal('');
  success     = signal(false);
  paymentSuccess = signal(false);
  avatarPreview = signal<string | null>(null);

  transactions        = signal<ServiceTransaction[]>([]);
  transactionsLoading = signal(true);
  syncingPendingPayments = signal(false);

  // Computed signals para estadísticas de transacciones
  completedTx = computed(() => this.transactions().filter(t => t.status === 'completed').length);
  pendingTx   = computed(() => this.transactions().filter(t => t.status === 'pending').length);

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
  }, { validators: (g) => g.get('new_password')?.value === g.get('confirm_password')?.value ? null : { passwordsMismatch: true } });

  private avatarFile: File | null = null;

  form = this.fb.group({
    full_name: this.fb.control('', {
      validators: [Validators.required],
      asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'profile')],
    }),
    phone:     [''],
    bio:       this.fb.control('', {
      asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'profile')],
    }),
  });

  showView(v: string): void {
    this.activeView.set(v);
    this.error.set('');
    this.success.set(false);
    this.pwError.set('');
    this.pwSuccess.set(false);
  }

  async changePassword(): Promise<void> {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }

    const confirmed = await this.modal.confirm(
      '¿Deseas cambiar tu contraseña?',
      'Confirmar cambio de contraseña',
      'Cambiar'
    );
    if (!confirmed) return;

    this.pwLoading.set(true);
    const { old_password, new_password } = this.pwForm.value;
    this.profileSvc.changePassword(old_password!, new_password!).subscribe({
      next: async () => {
        this.pwLoading.set(false);
        this.pwSuccess.set(true);
        this.pwForm.reset();
        await this.modal.success('Tu contraseña se actualizó correctamente.', 'Contraseña actualizada');
      },
      error: (err: any) => { this.pwLoading.set(false); this.pwError.set(err?.error?.detail ?? this.i18n.t('profile.errorChangePassword')); }
    });
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

    this.loadProfile();
    this.loadTransactions();
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd && e.urlAfterRedirects.includes('/provider/tabs/profile'))
    ).subscribe(() => { this.loadProfile(); this.loadTransactions(); });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private loadProfile(): void {
    this.providerSvc.getMyProfile().subscribe({
      next: (p) => {
        this.provider.set(p);
        this.form.patchValue({ full_name: p.full_name, phone: p.phone, bio: p.bio });
        if (p.avatar) this.avatarPreview.set(p.avatar);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private loadTransactions(): void {
    this.transactionsLoading.set(true);
    this.http.get<ServiceTransaction[]>(`${environment.apiUrl}/transactions/me`).subscribe({
      next: (txs) => { this.transactions.set(txs); this.transactionsLoading.set(false); },
      error: () => this.transactionsLoading.set(false)
    });
  }

  /**
   * Reconciliación manual: pide al backend revisar en Mercado Pago el estado
   * real de los pagos PENDING del proveedor y activar el beneficio si ya
   * fueron aprobados. Respaldo para cuando el webhook no alcanzó a procesar
   * la notificación (p.ej. reconciliación por preference_id fallida).
   */
  syncPendingPayments(): void {
    if (this.syncingPendingPayments()) return;
    this.syncingPendingPayments.set(true);
    this.paymentSvc.syncMercadoPagoPending().subscribe({
      next: () => {
        this.syncingPendingPayments.set(false);
        this.loadTransactions();
      },
      error: () => this.syncingPendingPayments.set(false)
    });
  }

  /** Plan activo: última transacción completed con expires_at en el futuro */
  get activePlan(): ServiceTransaction | null {
    const now = Date.now();
    return this.transactions().find(
      t => t.status === 'completed' && t.expires_at && (parseUtcDate(t.expires_at)?.getTime() ?? 0) > now
    ) ?? null;
  }

  /** Días restantes hasta vencimiento */
  remainingDays(expiresAt: string): number {
    const expires = parseUtcDate(expiresAt);
    if (!expires) return 0;
    return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86_400_000));
  }

  /** Porcentaje de tiempo consumido (para barra de progreso) */
  usedPercent(tx: ServiceTransaction): number {
    if (!tx.activated_at || !tx.expires_at) return 0;
    const activated = parseUtcDate(tx.activated_at);
    const expires = parseUtcDate(tx.expires_at);
    if (!activated || !expires) return 0;
    const total = expires.getTime() - activated.getTime();
    const used  = Date.now() - activated.getTime();
    return Math.min(100, Math.round((used / total) * 100));
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      completed: 'Activo', pending: 'Pendiente', failed: 'Fallido',
      refunded: 'Reembolsado', expired: 'Vencido'
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      completed: 'badge-success', pending: 'badge-warning',
      failed: 'badge-danger', refunded: 'badge-secondary', expired: 'badge-gray'
    };
    return map[status] ?? 'badge-gray';
  }

  getAvatarSrc(): string {
    const profile = this.provider();
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

  async save(): Promise<void> {
    if (this.form.pending) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const confirmed = await this.modal.confirm(
      '¿Deseas guardar los cambios en tu perfil?',
      'Confirmar cambios',
      'Guardar'
    );
    if (!confirmed) return;

    this.saveLoading.set(true);
    const save = () => {
      const payload = {
        ...this.form.value,
        phone: normalizeChileanPhoneForBackend((this.form.value.phone ?? '') as string)
      } as any;
      this.providerSvc.updateProfile(payload).subscribe({
        next: async (p) => {
          this.provider.set(p);
          this.saveLoading.set(false);
          this.success.set(true);
          this.activeView.set('overview');
          setTimeout(() => this.success.set(false), 3000);
          await this.modal.success('Tu perfil se actualizó correctamente.', 'Perfil actualizado');
        },
        error: (err) => { this.saveLoading.set(false); this.error.set(err?.error?.detail ?? this.i18n.t('profile.errorSaving')); }
      });
    };
    if (this.avatarFile) {
      this.profileSvc.uploadAvatar(this.avatarFile).subscribe({
        next: (res) => {
          if (res?.avatar_url) {
            this.avatarPreview.set(res.avatar_url);
          }
          save();
        },
        error: (err: any) => {
          this.saveLoading.set(false);
          this.error.set(err?.error?.detail ?? this.i18n.t('profile.errorUploadAvatar'));
        }
      });
    } else { save(); }
  }

  inviteFriends(): void {
    const shareData = {
      title: this.i18n.t('profile.inviteTitle'),
      text: this.i18n.t('profile.inviteText'),
      url: 'https://bapp.app'
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText('https://bapp.app').catch(() => {});
    }
  }

  logout(): void { this.auth.logout(); }
  goToVerifyIdentity(): void {
    this.router.navigate(['/auth/verify-identity']);
  }
  goToPayment(productType: ProviderProductType = 'PROVIDER_PLAN_MONTHLY'): void {
    this.router.navigate(['/payment'], {
      state: {
        product_type: productType,
        returnTo: '/provider/tabs/profile'
      }
    });
  }
}
