import { Component, inject, signal, computed, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, filter } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { ProviderProfile } from '../../../../core/models/provider.model';
import { environment } from '../../../../../environments/environment';

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

type ProviderProductType = 'PROVIDER_PREMIUM_MONTHLY' | 'PROVIDER_SERVICE_30' | 'PROVIDER_SERVICE_YEAR';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
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

  // Computed signals para estadísticas de transacciones
  completedTx = computed(() => this.transactions().filter(t => t.status === 'completed').length);
  pendingTx   = computed(() => this.transactions().filter(t => t.status === 'pending').length);

  pwLoading = signal(false);
  pwError   = signal('');
  pwSuccess = signal(false);

  pwForm = this.fb.group({
    old_password:     ['', Validators.required],
    new_password:     ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', Validators.required],
  }, { validators: (g) => g.get('new_password')?.value === g.get('confirm_password')?.value ? null : { passwordsMismatch: true } });

  private avatarFile: File | null = null;

  form = this.fb.group({
    full_name: ['', Validators.required],
    phone:     [''],
    bio:       [''],
  });

  showView(v: string): void {
    this.activeView.set(v);
    this.error.set('');
    this.success.set(false);
    this.pwError.set('');
    this.pwSuccess.set(false);
  }

  changePassword(): void {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }
    this.pwLoading.set(true);
    const { old_password, new_password } = this.pwForm.value;
    this.profileSvc.changePassword(old_password!, new_password!).subscribe({
      next: () => { this.pwLoading.set(false); this.pwSuccess.set(true); this.pwForm.reset(); },
      error: (err: any) => { this.pwLoading.set(false); this.pwError.set(err?.error?.detail ?? 'Error al cambiar contraseña.'); }
    });
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

  /** Plan activo: última transacción completed con expires_at en el futuro */
  get activePlan(): ServiceTransaction | null {
    const now = new Date();
    return this.transactions().find(
      t => t.status === 'completed' && t.expires_at && new Date(t.expires_at) > now
    ) ?? null;
  }

  /** Días restantes hasta vencimiento */
  remainingDays(expiresAt: string): number {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
  }

  /** Porcentaje de tiempo consumido (para barra de progreso) */
  usedPercent(tx: ServiceTransaction): number {
    if (!tx.activated_at || !tx.expires_at) return 0;
    const total = new Date(tx.expires_at).getTime() - new Date(tx.activated_at).getTime();
    const used  = Date.now() - new Date(tx.activated_at).getTime();
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

  onAvatarChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = e => this.avatarPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saveLoading.set(true);
    const save = () => {
      this.providerSvc.updateProfile(this.form.value as any).subscribe({
        next: (p) => { this.provider.set(p); this.saveLoading.set(false); this.success.set(true); this.activeView.set('overview'); setTimeout(() => this.success.set(false), 3000); },
        error: (err) => { this.saveLoading.set(false); this.error.set(err?.error?.detail ?? 'Error al guardar.'); }
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
          this.error.set(err?.error?.detail ?? 'Error al subir avatar.');
        }
      });
    } else { save(); }
  }

  inviteFriends(): void {
    const shareData = {
      title: 'Únete a BAPP',
      text: 'Descarga BAPP y encuentra los mejores servicios cerca de ti.',
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
  goToPayment(productType: ProviderProductType = 'PROVIDER_PREMIUM_MONTHLY'): void {
    this.router.navigate(['/payment'], {
      queryParams: {
        product_type: productType,
        returnTo: '/provider/tabs/profile'
      }
    });
  }
}
