import { Injectable, signal } from '@angular/core';

// { [serviceId]: [providerId, providerId, ...] }
type ContactMap = Record<number, number[]>;

const STORAGE_KEY = 'bapp_contacts_v2';
const OLD_KEY     = 'bapp_contacted_providers';
export const FREE_CONTACT_LIMIT = 5;

@Injectable({ providedIn: 'root' })
export class ContactLimitService {
  private contactMap = signal<ContactMap>(this.loadFromStorage());

  readonly FREE_LIMIT = FREE_CONTACT_LIMIT;

  /** Contactos gratuitos restantes para un servicio */
  remaining(serviceId: number): number {
    const contacted = this.contactMap()[serviceId] ?? [];
    return Math.max(0, FREE_CONTACT_LIMIT - contacted.length);
  }

  /** true si se alcanzó el límite para el servicio */
  hasReachedLimit(serviceId: number): boolean {
    return this.remaining(serviceId) === 0;
  }

  /** true si puede contactar: ya lo contactó antes O tiene slots libres */
  canContact(serviceId: number, providerId: number): boolean {
    const contacted = this.contactMap()[serviceId] ?? [];
    if (contacted.includes(providerId)) return true;
    return !this.hasReachedLimit(serviceId);
  }

  /** IDs de proveedores ya contactados para un serviceId */
  contactedProviders(serviceId: number): number[] {
    return this.contactMap()[serviceId] ?? [];
  }

  /** Registra un contacto; idempotente */
  recordContact(serviceId: number, providerId: number): void {
    const current    = this.contactMap();
    const forService = current[serviceId] ?? [];
    if (forService.includes(providerId)) return;
    const updated = { ...current, [serviceId]: [...forService, providerId] };
    this.contactMap.set(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* safari private */ }
  }

  private loadFromStorage(): ContactMap {
    try {
      // Migrar datos del formato anterior (pool global sin service_id)
      const legacy = localStorage.getItem(OLD_KEY);
      if (legacy) {
        const ids: unknown = JSON.parse(legacy);
        if (Array.isArray(ids) && ids.length > 0) {
          const migrated: ContactMap = { 0: ids as number[] };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.removeItem(OLD_KEY);
          return migrated;
        }
        localStorage.removeItem(OLD_KEY);
      }

      const raw    = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (typeof parsed === 'object' && parsed !== null) ? parsed as ContactMap : {};
    } catch { return {}; }
  }
}
