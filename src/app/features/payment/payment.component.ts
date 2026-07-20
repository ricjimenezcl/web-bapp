import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService, ProductType } from '../../core/services/payment.service';
import { StorageService } from '../../core/services/storage.service';
import { environment } from '../../../environments/environment';
import { catchError, firstValueFrom, of } from 'rxjs';

export type PayMethod = 'transbank' | 'mercadopago' | 'transferencia';

const CLIENT_PRODUCT_TYPES: ProductType[] = [
  'CLIENT_UNLOCK_7',
  'CLIENT_UNLOCK_30',
];

const PROVIDER_PRODUCT_TYPES: ProductType[] = [
  'PROVIDER_SERVICE_30',
  'PROVIDER_SERVICE_YEAR',
  'PROVIDER_LEADS_7',
  'PROVIDER_LEADS_30',
  'PROVIDER_PREMIUM_MONTHLY',
  'PROVIDER_PREMIUM_ANNUAL',
];

interface PlanUi {
  productType: ProductType;
  title: string;
  subtitle: string;
  price: number;
  period: string;
  benefits: string[];
}

const PLAN_CATALOG: Record<ProductType, PlanUi> = {
  CLIENT_UNLOCK_7: {
    productType: 'CLIENT_UNLOCK_7',
    title: 'Acceso Cliente 7 días',
    subtitle: 'Desbloquea proveedores bloqueados por 7 días',
    price: 1490,
    period: 'pago único',
    benefits: ['🔓 Acceso a todos los proveedores', '💬 Contacto sin límites', '⚡ Activación inmediata']
  },
  CLIENT_UNLOCK_30: {
    productType: 'CLIENT_UNLOCK_30',
    title: 'Acceso Cliente 30 días',
    subtitle: 'Más tiempo para contactar proveedores',
    price: 4990,
    period: 'pago único',
    benefits: ['🔓 Acceso extendido 30 días', '📈 Mejor conversión de búsqueda', '✅ Ideal para proyectos largos']
  },
  PROVIDER_SERVICE_30: {
    productType: 'PROVIDER_SERVICE_30',
    title: 'Servicio adicional 30 días',
    subtitle: 'Publica desde tu 3er servicio',
    price: 1990,
    period: 'pago único',
    benefits: ['➕ Publicación de servicio premium', '📍 Más visibilidad en búsquedas', '🗓️ Vigencia 30 días']
  },
  PROVIDER_SERVICE_YEAR: {
    productType: 'PROVIDER_SERVICE_YEAR',
    title: 'Servicio adicional 1 año',
    subtitle: 'Costo anual preferente',
    price: 17990,
    period: 'pago único',
    benefits: ['📆 365 días de publicación', '💰 Mejor costo total', '🚀 Escala tu oferta']
  },
  PROVIDER_LEADS_7: {
    productType: 'PROVIDER_LEADS_7',
    title: 'Leads 7 días',
    subtitle: 'Desbloquea clientes interesados',
    price: 1490,
    period: 'pago único',
    benefits: ['👀 Ver clientes reales interesados', '📞 Datos de contacto completos', '⚡ Activación inmediata']
  },
  PROVIDER_LEADS_30: {
    productType: 'PROVIDER_LEADS_30',
    title: 'Leads 30 días',
    subtitle: 'Pipeline comercial mensual',
    price: 4990,
    period: 'pago único',
    benefits: ['📈 Mayor ventana de conversión', '🔓 Leads completos por 30 días', '💼 Ideal para captación continua']
  },
  PROVIDER_PREMIUM_MONTHLY: {
    productType: 'PROVIDER_PREMIUM_MONTHLY',
    title: 'Premium Proveedor mensual',
    subtitle: 'Perfil y herramientas premium',
    price: 5990,
    period: 'mensual',
    benefits: ['🔥 Más clientes', '✔ Perfil destacado', '🔓 Accesos premium completos']
  },
  PROVIDER_PREMIUM_ANNUAL: {
    productType: 'PROVIDER_PREMIUM_ANNUAL',
    title: 'Premium Proveedor anual',
    subtitle: 'Plan anual preferente',
    price: 49990,
    period: 'anual',
    benefits: ['🔥 Más clientes todo el año', '⭐ Perfil destacado y prioridad', '➕ Hasta 7 servicios activos']
  }
};

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
})
export class PaymentComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly paymentSvc = inject(PaymentService);
  private readonly storage = inject(StorageService);
  private readonly http = inject(HttpClient);

  readonly user     = this.auth.currentProfile;
  readonly userRole = this.auth.currentUser()?.role ?? 'CLIENT';
  readonly plans = Object.values(PLAN_CATALOG);
  readonly visiblePlans = computed(() => {
    const allowed = this.userRole === 'PROVIDER' ? PROVIDER_PRODUCT_TYPES : CLIENT_PRODUCT_TYPES;
    return this.plans.filter(plan => allowed.includes(plan.productType));
  });

  selectedMethod = signal<PayMethod>('transbank');
  selectedProductType = signal<ProductType>('CLIENT_UNLOCK_7');
  processing = signal(false);
  committing = signal(false);
  success = signal(false);
  error = signal('');
  returnTo = signal<string | null>(null);

  readonly activePlan = computed(() => PLAN_CATALOG[this.selectedProductType()]);

  ngOnInit(): void {
    // product_type/returnTo llegan preferentemente via router state (no
    // quedan expuestos en la URL). Se mantiene fallback a queryParams por
    // compatibilidad con el bridge de la app móvil (/app-payment).
    const navState = (globalThis.history?.state ?? {}) as { product_type?: ProductType; returnTo?: string };

    this.route.queryParamMap.subscribe(params => {
      const productType = (navState.product_type ?? params.get('product_type')) as ProductType | null;
      const returnTo = navState.returnTo ?? params.get('returnTo');

      // Contrato del bridge backend /payments/transbank/return: redirige con
      // status=success|cancelled y buy_order (nunca expone token_ws en la URL).
      const status = params.get('status');
      const buyOrder = params.get('buy_order');

      // Fallback legacy por si queda algún enlace/caché apuntando al flujo
      // anterior (token_ws directo en query).
      const tokenWs = params.get('token_ws');
      const tbkToken = params.get('TBK_TOKEN');

      if (returnTo) this.returnTo.set(returnTo);

      const rolePlans = this.visiblePlans();
      const rolePlanTypes = new Set(rolePlans.map(plan => plan.productType));

      if (productType && rolePlanTypes.has(productType)) {
        this.selectedProductType.set(productType);
      }

      if (!rolePlanTypes.has(this.selectedProductType()) && rolePlans.length > 0) {
        this.selectedProductType.set(rolePlans[0].productType);
      }

      // Flujo normal de retorno Webpay (pago autorizado) vía bridge backend
      if (status === 'success' && buyOrder) {
        this.commit({ buy_order: buyOrder });
        return;
      }

      if (status === 'cancelled') {
        this.error.set('El pago fue cancelado o expiró en Webpay. Puedes intentarlo nuevamente.');
        return;
      }

      // Fallback legacy
      if (tokenWs) {
        this.commit({ token: tokenWs });
        return;
      }

      if (tbkToken) {
        this.error.set('El pago fue cancelado o expiró en Webpay. Puedes intentarlo nuevamente.');
      }
    });
  }

  selectMethod(m: PayMethod): void {
    this.selectedMethod.set(m);
  }

  selectPlan(productType: ProductType): void {
    const rolePlanTypes = new Set(this.visiblePlans().map(plan => plan.productType));
    if (!rolePlanTypes.has(productType)) return;

    this.selectedProductType.set(productType);
    this.success.set(false);
    this.error.set('');
  }

  goBack(): void {
    const back = this.returnTo();
    if (back) {
      if (back.startsWith('bapp://')) {
        window.location.href = back;
        return;
      }
      this.router.navigateByUrl(back);
      return;
    }
    if (this.userRole === 'PROVIDER') {
      this.router.navigate(['/provider/tabs/profile']);
    } else {
      this.router.navigate(['/client/tabs/profile']);
    }
  }

  pay(): void {
    const method = this.selectedMethod();

    if (method !== 'transbank') {
      this.error.set(
        method === 'mercadopago'
          ? 'Mercado Pago estará disponible próximamente. Mientras tanto puedes pagar con Transbank.'
          : 'Transferencia bancaria estará disponible próximamente. Mientras tanto puedes pagar con Transbank.'
      );
      return;
    }

    const plan = this.activePlan();
    this.processing.set(true);
    this.error.set('');

    this.paymentSvc.createTransaction({
      product_type: plan.productType,
      amount: plan.price,
      return_url: window.location.origin,
    }).subscribe({
      next: (res) => {
        this.processing.set(false);
        this.redirectToWebpay(res.url, res.token);
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo iniciar el pago con Webpay.');
      }
    });
  }

  getPayButtonText(): string {
    if (this.processing()) return 'Procesando...';

    if (this.selectedMethod() === 'transbank') {
      return `Continuar con Transbank $${this.activePlan().price.toLocaleString('es-CL')} CLP`;
    }

    return 'Método no disponible todavía';
  }

  private commit(params: { token?: string; buy_order?: string }): void {
    this.committing.set(true);
    this.error.set('');

    this.paymentSvc.commitTransaction(params).subscribe({
      next: async (res) => {
        this.committing.set(false);
        if (res.success) {
          const verification = await this.syncPostPaymentState(res.buy_order ?? params.buy_order);
          if (!verification.ok && verification.message) {
            this.error.set(verification.message);
          }

          this.success.set(true);
          // Si el flujo indicó a dónde volver (returnTo), respetarlo
          // (p.ej. /provider/add-service tras desbloquear el 3er servicio).
          // Si no, caer al perfil del usuario como destino por defecto.
          const target = this.returnTo() ?? (
            this.userRole === 'PROVIDER'
              ? '/provider/tabs/profile'
              : '/client/tabs/profile'
          );

          if (target.startsWith('bapp://')) {
            const deepLink = this.appendQueryParams(target, {
              status: 'success',
              productType: this.selectedProductType(),
              buyOrder: res.buy_order ?? params.buy_order,
              expiresAt: res.expires_at,
            });
            window.location.href = deepLink;
            return;
          }

          this.router.navigate([target], {
            queryParams: {
              paymentSuccess: 'true',
            },
            replaceUrl: true,
          });
        } else {
          this.error.set(res.error ?? 'No se pudo confirmar el pago.');
        }
      },
      error: (err) => {
        this.committing.set(false);
        this.error.set(err?.error?.detail ?? 'Error confirmando el pago.');
      }
    });
  }

  private async syncPostPaymentState(buyOrder?: string): Promise<{ ok: boolean; message?: string }> {
    const [userMe, txs] = await Promise.all([
      firstValueFrom(this.http.get<any>(`${environment.apiUrl}/users/me`).pipe(catchError(() => of(null)))),
      firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/transactions/me`).pipe(catchError(() => of([]))))
    ]);

    await firstValueFrom(this.auth.fetchProfile().pipe(catchError(() => of(null))));

    const current = this.storage.user();
    if (userMe && current) {
      this.storage.setUser({
        ...current,
        email: userMe.email ?? current.email,
        role: userMe.role ?? current.role,
        status: userMe.status ?? current.status,
        has_premium: userMe.has_premium ?? userMe.profile?.has_premium ?? current.has_premium,
      });
    }

    if (buyOrder) {
      const found = (txs ?? []).some(tx => {
        const txOrder = String(tx?.buy_order ?? '');
        const status = String(tx?.status ?? '').toLowerCase();
        return txOrder === buyOrder && (status === 'completed' || status === 'authorized');
      });
      if (!found) {
        return {
          ok: false,
          message: 'El pago fue aprobado, pero la confirmación de transacción aún no aparece. Recarga tu perfil en unos segundos.',
        };
      }
    }

    return { ok: true };
  }

  private appendQueryParams(baseUrl: string, params: Record<string, string | undefined>): string {
    const [head, hash = ''] = baseUrl.split('#', 2);
    const url = new URL(head);

    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }

    return hash ? `${url.toString()}#${hash}` : url.toString();
  }

  private redirectToWebpay(url: string, token: string): void {
    // Marcar que se espera un retorno de Webpay para que la SPA no invalide
    // la sesión de la pestaña al navegar fuera del dominio.
    this.storage.markPaymentRedirectPending();

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;

    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'token_ws';
    tokenInput.value = token;

    form.appendChild(tokenInput);
    document.body.appendChild(form);
    form.submit();
  }
}
