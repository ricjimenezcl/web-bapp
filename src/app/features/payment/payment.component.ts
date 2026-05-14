import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService, ProductType } from '../../core/services/payment.service';

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
    this.route.queryParamMap.subscribe(params => {
      const productType = params.get('product_type') as ProductType | null;
      const tokenWs = params.get('token_ws');
      const tbkToken = params.get('TBK_TOKEN');
      const returnTo = params.get('returnTo');

      if (returnTo) this.returnTo.set(returnTo);

      const rolePlans = this.visiblePlans();
      const rolePlanTypes = new Set(rolePlans.map(plan => plan.productType));

      if (productType && rolePlanTypes.has(productType)) {
        this.selectedProductType.set(productType);
      }

      if (!rolePlanTypes.has(this.selectedProductType()) && rolePlans.length > 0) {
        this.selectedProductType.set(rolePlans[0].productType);
      }

      // Flujo normal de retorno Webpay (pago autorizado)
      if (tokenWs) {
        this.commit(tokenWs);
        return;
      }

      // Flujo cancelado/abortado en Webpay
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

  private commit(token: string): void {
    this.committing.set(true);
    this.error.set('');

    this.paymentSvc.commitTransaction(token).subscribe({
      next: (res) => {
        this.committing.set(false);
        if (res.success) {
          this.success.set(true);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
              product_type: this.selectedProductType(),
              returnTo: this.returnTo() ?? undefined,
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

  private redirectToWebpay(url: string, token: string): void {
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
