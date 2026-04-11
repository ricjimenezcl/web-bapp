import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'bapp_contacted_providers';
export const FREE_CONTACT_LIMIT = 5;

@Injectable({ providedIn: 'root' })
export class ContactLimitService {
  private contacted = signal<number[]>(this.loadFromStorage());

  readonly count          = computed(() => this.contacted().length);
  readonly remaining      = computed(() => Math.max(0, FREE_CONTACT_LIMIT - this.contacted().length));
  readonly hasReachedLimit = computed(() => this.contacted().length >= FREE_CONTACT_LIMIT);
  readonly FREE_LIMIT = FREE_CONTACT_LIMIT;

  /** true si el proveedor ya fue contactado o si el límite no se ha alcanzado */
  canContact(providerId: number): boolean {
    if (this.contacted().includes(providerId)) return true; // ya contactado → permitir
    return !this.hasReachedLimit();
  }

  /** Registra un nuevo contacto; no duplica si ya existe */
  recordContact(providerId: number): void {
    if (this.contacted().includes(providerId)) return;
    const updated = [...this.contacted(), providerId];
    this.contacted.set(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* safari private */ }
  }

  private loadFromStorage(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
}
