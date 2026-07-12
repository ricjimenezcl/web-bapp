import { Injectable, signal } from '@angular/core';
import { ServiceProvider } from '../models/provider.model';

export interface SearchFilters {
  service_ids?: number[];
  service_names?: { id: number; name: string }[];
  category_id?: number | null;
  query?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

interface PersistedSearchState {
  providers: ServiceProvider[];
  filters: SearchFilters;
  userLocation: { lat: number; lng: number } | null;
  hasSearched: boolean;
}

const STORAGE_KEY = 'bapp_search_state';

@Injectable({ providedIn: 'root' })
export class SearchStateService {
  // Estado de búsqueda compartido entre tabs
  private readonly _providers = signal<ServiceProvider[]>([]);
  private readonly _filters = signal<SearchFilters>({});
  private readonly _userLocation = signal<{ lat: number; lng: number } | null>(null);
  private readonly _hasSearched = signal(false);

  // Readonly accessors
  readonly providers = this._providers.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly userLocation = this._userLocation.asReadonly();
  readonly hasSearched = this._hasSearched.asReadonly();

  constructor() {
    this.restoreFromStorage();
  }

  // Actualizar proveedores encontrados
  setProviders(providers: ServiceProvider[]): void {
    this._providers.set(providers);
    this._hasSearched.set(true);
    this.persist();
  }

  // Actualizar filtros de búsqueda
  setFilters(filters: SearchFilters): void {
    this._filters.set(filters);
    this.persist();
  }

  // Actualizar ubicación del usuario
  setUserLocation(lat: number, lng: number): void {
    this._userLocation.set({ lat, lng });
    this.persist();
  }

  // Limpiar estado
  clear(): void {
    this._providers.set([]);
    this._filters.set({});
    this._hasSearched.set(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }

  // Agregar/actualizar filtros parcialmente
  updateFilters(partialFilters: Partial<SearchFilters>): void {
    this._filters.update(current => ({ ...current, ...partialFilters }));
    this.persist();
  }

  private persist(): void {
    try {
      const state: PersistedSearchState = {
        providers: this._providers(),
        filters: this._filters(),
        userLocation: this._userLocation(),
        hasSearched: this._hasSearched(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* quota exceeded or storage unavailable */ }
  }

  private restoreFromStorage(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: PersistedSearchState = JSON.parse(raw);
      if (state.hasSearched) {
        this._providers.set(state.providers ?? []);
        this._filters.set(state.filters ?? {});
        this._userLocation.set(state.userLocation ?? null);
        this._hasSearched.set(true);
      }
    } catch { /* corrupted data — ignore */ }
  }
}
