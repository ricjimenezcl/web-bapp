import { Injectable } from '@angular/core';

export type ServiceLimitProductType = 'PROVIDER_SERVICE_30' | 'PROVIDER_PREMIUM_MONTHLY' | 'PROVIDER_PREMIUM_ANNUAL';

export interface ServiceLimitEvaluation {
  canCreate: boolean;
  activeServices: number;
  maxServices: number;
  hasBasePlan: boolean;
  hasPremiumPlan: boolean;
  usedFreeBenefit: boolean;
  suggestedProductType: ServiceLimitProductType;
  gateMessage: string;
}

/**
 * Cantidad de servicios que un proveedor sin plan pagado puede crear gratis, UNA sola vez en la vida
 * de la cuenta. A diferencia del conteo de "servicios activos", este beneficio no se restaura al
 * eliminar un servicio: se persiste en localStorage como marca de agua (solo puede subir, nunca bajar).
 */
export const FREE_SERVICES_LIMIT = 2;

@Injectable({ providedIn: 'root' })
export class ServiceEntitlementService {
  private storageKey(userId: number | string): string {
    return `bapp_free_services_used_${userId}`;
  }

  getFreeServicesUsed(userId: number | string | null | undefined): number {
    if (userId == null) return 0;
    try {
      const raw = localStorage.getItem(this.storageKey(userId));
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  hasUsedFreeBenefit(userId: number | string | null | undefined): boolean {
    return this.getFreeServicesUsed(userId) >= FREE_SERVICES_LIMIT;
  }

  /** Marca de agua: solo sube. Se usa al leer el listado de servicios para "sembrar" el beneficio
   * ya consumido por cuentas que llegaron a 2 servicios activos antes de este fix. */
  seedFromActiveCount(userId: number | string | null | undefined, activeCount: number): void {
    if (userId == null) return;
    const current = this.getFreeServicesUsed(userId);
    const next = Math.min(Math.max(current, activeCount), FREE_SERVICES_LIMIT);
    if (next !== current) {
      this.setFreeServicesUsed(userId, next);
    }
  }

  /** Se debe invocar solo cuando la creación exitosa realmente consumió un cupo gratuito
   * (es decir, el proveedor no tenía plan base ni premium activo al momento de crear el servicio). */
  recordServiceCreated(userId: number | string | null | undefined): void {
    if (userId == null) return;
    const current = this.getFreeServicesUsed(userId);
    this.setFreeServicesUsed(userId, Math.min(current + 1, FREE_SERVICES_LIMIT));
  }

  private setFreeServicesUsed(userId: number | string, value: number): void {
    try {
      localStorage.setItem(this.storageKey(userId), String(value));
    } catch {
      // localStorage no disponible (modo privado, etc.) — se ignora silenciosamente.
    }
  }

  evaluate(userId: number | string | null | undefined, services: any[], transactions: any[]): ServiceLimitEvaluation {
    const now = Date.now();
    const activeServices = (services ?? []).filter((s: any) => !!s?.is_available).length;

    const activePlanTypes = (transactions ?? [])
      .filter((tx: any) => this.isActiveTransaction(tx, now))
      .map((tx: any) => this.readProductType(tx));

    const hasPremiumPlan = activePlanTypes.some((pt: string) =>
      pt.includes('PROVIDER_PREMIUM_MONTHLY') ||
      pt.includes('PROVIDER_PREMIUM_ANNUAL') ||
      (pt.includes('PROVIDER_PREMIUM') && (pt.includes('YEAR') || pt.includes('ANNUAL')))
    );

    const hasBasePlan = activePlanTypes.some((pt: string) =>
      pt.includes('PROVIDER_SERVICE_30') || pt.includes('PROVIDER_SERVICE_YEAR') || pt.includes('PROVIDER_SERVICE_ANNUAL')
    );

    this.seedFromActiveCount(userId, activeServices);
    const usedFreeBenefit = this.hasUsedFreeBenefit(userId);
    const noPaidPlan = !hasBasePlan && !hasPremiumPlan;

    const maxServices = hasPremiumPlan ? 7 : hasBasePlan ? 3 : 2;
    const canCreate = noPaidPlan
      ? activeServices < maxServices && !usedFreeBenefit
      : activeServices < maxServices;

    const base = { activeServices, maxServices, hasBasePlan, hasPremiumPlan, usedFreeBenefit };

    if (canCreate) {
      return {
        ...base,
        canCreate,
        suggestedProductType: hasPremiumPlan ? 'PROVIDER_PREMIUM_ANNUAL' : 'PROVIDER_SERVICE_30',
        gateMessage: '',
      };
    }

    if (noPaidPlan && usedFreeBenefit) {
      return {
        ...base,
        canCreate,
        suggestedProductType: 'PROVIDER_SERVICE_30',
        gateMessage: 'Ya utilizaste tu beneficio de 2 servicios gratuitos (aunque hayas eliminado alguno). Activa un plan mensual o anual para publicar más servicios.',
      };
    }

    if (noPaidPlan && activeServices >= 2) {
      return {
        ...base,
        canCreate,
        suggestedProductType: 'PROVIDER_SERVICE_30',
        gateMessage: 'Ya alcanzaste los 2 servicios del plan gratuito. Activa un plan mensual o anual para publicar tu tercer servicio.',
      };
    }

    if (!hasPremiumPlan && activeServices >= 3) {
      return {
        ...base,
        canCreate,
        suggestedProductType: 'PROVIDER_PREMIUM_ANNUAL',
        gateMessage: 'Tu plan actual permite hasta 3 servicios. Para publicar más, activa Premium mensual o Premium anual (hasta 7 servicios activos).',
      };
    }

    return {
      ...base,
      canCreate,
      suggestedProductType: 'PROVIDER_PREMIUM_ANNUAL',
      gateMessage: 'Ya alcanzaste el máximo de 7 servicios activos para planes Premium.',
    };
  }

  private isActiveTransaction(tx: any, nowMs: number): boolean {
    const status = String(tx?.status ?? '').toLowerCase();
    if (!(status === 'completed' || status === 'authorized')) return false;
    const expiresAt = tx?.expires_at;
    if (!expiresAt) return true;
    const exp = new Date(expiresAt).getTime();
    return Number.isFinite(exp) && exp > nowMs;
  }

  private readProductType(tx: any): string {
    return String(
      tx?.product_type ?? tx?.product?.sku ?? tx?.product?.product_type ?? tx?.sku ?? ''
    ).toUpperCase();
  }
}
