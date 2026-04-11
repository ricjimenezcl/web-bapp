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

  // Actualizar proveedores encontrados
  setProviders(providers: ServiceProvider[]): void {
    this._providers.set(providers);
    this._hasSearched.set(true);
  }

  // Actualizar filtros de búsqueda
  setFilters(filters: SearchFilters): void {
    this._filters.set(filters);
  }

  // Actualizar ubicación del usuario
  setUserLocation(lat: number, lng: number): void {
    this._userLocation.set({ lat, lng });
  }

  // Limpiar estado
  clear(): void {
    this._providers.set([]);
    this._filters.set({});
    this._hasSearched.set(false);
  }

  // Agregar/actualizar filtros parcialmente
  updateFilters(partialFilters: Partial<SearchFilters>): void {
    this._filters.update(current => ({ ...current, ...partialFilters }));
  }
}
