import { Component, inject, signal, computed, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SearchStateService } from '../../../../core/services/search-state.service';
import { LocationService } from '../../../../core/services/location.service';
import { ServiceProvider, MainCategory } from '../../../../core/models/provider.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';
import { ServiceMapComponent } from '../service-map/service-map.component';
import { ContactLimitService } from '../../../../core/services/contact-limit.service';

@Component({
  selector: 'app-service-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent, ServiceMapComponent],
  templateUrl: './service-search.component.html',
  styleUrl: './service-search.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ServiceSearchComponent implements OnInit {
  private readonly fb           = inject(FormBuilder);
  private readonly providerSvc  = inject(ProviderService);
  private readonly categorySvc  = inject(CategoryService);
  private readonly route        = inject(ActivatedRoute);
  private readonly searchState  = inject(SearchStateService);
  private readonly locationSvc  = inject(LocationService);
  readonly contactLimit         = inject(ContactLimitService);

  providers         = signal<ServiceProvider[]>([]);
  filteredProviders = signal<ServiceProvider[]>([]);
  categories        = signal<MainCategory[]>([]);
  loading           = signal(false);
  selectedCat       = signal<number | null>(null);
  searchTerm        = signal('');
  error             = signal('');
  showInitial       = signal(true);
  selectedFilter    = signal<'distance' | 'rating'>('distance');
  serviceIds        = signal<number[]>([]);
  // Nombres de los servicios buscados (recibidos por queryParam para mostrar inmediatamente)
  serviceNames      = signal<{ id: number; name: string }[]>([]);
  /** Toggle móvil: lista o mapa */
  viewMode          = signal<'list' | 'map'>('list');
  /** Provider con hover en la lista — se sincroniza con el highlight del mapa */
  hoveredProviderId = signal<number | null>(null);
  /** true en dispositivos táctiles/móvil (sin hover fino) */
  readonly isMobile = signal(!globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches);

  /**
   * Chips a mostrar en el header:
   * - service_ids activos → nombre del servicio buscado (desde queryParam, inmediato)
   * - text-search → filtros por categoría principal
   */
  displayedCategories = computed((): { id: number; name: string; icon?: string }[] => {
    if (this.serviceIds().length > 0) return this.serviceNames();
    return this.categories();
  });

  searchControl = this.fb.control('');

  ngOnInit(): void {
    // Restaurar estado previo de búsqueda
    if (this.searchState.hasSearched()) {
      const filters = this.searchState.filters();
      this.providers.set(this.searchState.providers());
      this.showInitial.set(false);
      if (filters.service_ids?.length) {
        this.serviceIds.set(filters.service_ids);
      }
      if (filters.service_names?.length) {
        this.serviceNames.set(filters.service_names);
      }
      if (filters.query) {
        this.searchControl.setValue(filters.query, { emitEvent: false });
        this.searchTerm.set(filters.query);
      }
      this.applyFilter();
    }

    // Cargar categorías principales (usado para chips de filtro en búsqueda por texto)
    this.categorySvc.getMainCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {}
    });

    // Leer service_ids de queryParams
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (!params['service_ids']) {
        if (!this.searchState.hasSearched()) {
          this.showInitial.set(true);
        }
        return;
      }

      const ids   = params['service_ids'].split(',').map((id: string) => +id);
      const names = params['service_names']
        ? params['service_names'].split(',').map((name: string, i: number) => ({ id: ids[i], name: name.trim() }))
        : [];
      this.serviceIds.set(ids);
      if (names.length > 0) this.serviceNames.set(names);
      this.showInitial.set(false);

      // Evitar re-llamada si ya hay estado guardado para los mismos IDs
      const savedFilters = this.searchState.filters();
      const savedIds = [...(savedFilters.service_ids || [])].sort((a, b) => a - b);
      const newIds   = [...ids].sort((a, b) => a - b);
      const hasMatchingState = this.searchState.hasSearched() &&
                               JSON.stringify(savedIds) === JSON.stringify(newIds);

      if (!hasMatchingState) {
        this.searchByServiceIds(ids);
      }
    });

    // Búsqueda reactiva con debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term ?? '');
      this.showInitial.set(false);
      this.search();
    });
  }

  selectCategory(id: number | null): void {
    this.selectedCat.set(id);
    this.applyFilter();
  }

  /**
   * Búsqueda por texto libre.
   * Cuando hay service_ids activos filtra localmente sin nueva llamada API.
   * Cuando NO hay service_ids llama al endpoint de text-search.
   */
  search(): void {
    const term = this.searchTerm();

    // Modo service_ids: filtrar localmente sobre los proveedores ya cargados
    if (this.serviceIds().length > 0) {
      this.applyFilter();
      return;
    }

    // Modo text-search: requiere mínimo 2 caracteres
    if (!term || term.length < 2) {
      this.providers.set([]);
      this.filteredProviders.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.providerSvc.searchProviders({ query: term }).subscribe({
      next: (res) => {
        const cat = this.selectedCat();
        const filtered = cat
          ? res.filter(p => p.service_category?.main_category_id === cat)
          : res;
        this.providers.set(filtered);
        this.applyFilter();
        this.searchState.setProviders(this.filteredProviders());
        this.searchState.setFilters({ query: term, category_id: this.selectedCat() });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar proveedores.');
        this.loading.set(false);
      }
    });
  }

  searchByServiceIds(serviceIds: number[]): void {
    if (serviceIds.length === 0) return;
    this.loading.set(true);
    this.error.set('');

    // Verificar si hay una ubicación seleccionada (desde categories)
    const selectedLocation = this.locationSvc.getSelectedLocation();
    
    if (selectedLocation) {
      // Usar ubicación seleccionada por el usuario
      console.log('🌍 Usando ubicación seleccionada:', selectedLocation.name, `(${selectedLocation.lat}, ${selectedLocation.lon})`);
      this.fetchProvidersByLocation(serviceIds, selectedLocation.lat, selectedLocation.lon);
      return;
    }

    // Si no hay ubicación seleccionada, usar geolocation del navegador
    console.log('📍 Obteniendo ubicación actual del dispositivo...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => this.fetchProvidersByLocation(serviceIds, pos.coords.latitude, pos.coords.longitude),
        ()    => this.fetchProvidersByLocation(serviceIds, -33.4489, -70.6693) // Fallback: Santiago Centro
      );
    } else {
      // Fallback si no hay geolocation disponible
      this.fetchProvidersByLocation(serviceIds, -33.4489, -70.6693);
    }
  }

  private fetchProvidersByLocation(serviceIds: number[], lat: number, lng: number): void {
    const radius = 20;
    const requests = serviceIds.map(id =>
      this.providerSvc.getNearbyProvidersByServiceId(lat, lng, radius, id, 0, 20)
    );

    forkJoin(requests).subscribe({
      next: (results: ServiceProvider[][]) => {
        const uniqueProviders = this.removeDuplicates(results.flat());
        this.providers.set(uniqueProviders);
        this.applyFilter();
        this.searchState.setProviders(this.filteredProviders());
        this.searchState.setUserLocation(lat, lng);
        this.searchState.setFilters({
          service_ids: serviceIds,
          service_names: this.serviceNames(),
          latitude: lat, longitude: lng, radius
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar proveedores.');
        this.loading.set(false);
      }
    });
  }

  private removeDuplicates(providers: ServiceProvider[]): ServiceProvider[] {
    const seen = new Set<number>();
    return providers.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  changeFilter(filter: 'distance' | 'rating'): void {
    this.selectedFilter.set(filter);
    this.applyFilter();
  }

  /**
   * Aplica filtro de texto local + ordenamiento.
   * Iguala el comportamiento de frontend-bapp (applyFilter local sin re-llamada API).
   */
  private applyFilter(): void {
    let filtered = [...this.providers()];

    // Filtro de texto local (igual que frontend-bapp)
    const term = this.searchTerm().toLowerCase().trim();
    if (term.length >= 2) {
      filtered = filtered.filter(p =>
        p.business_name?.toLowerCase().includes(term) ||
        p.full_name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    // Filtro por categoría principal (sólo en modo text-search)
    const cat = this.selectedCat();
    if (cat && this.serviceIds().length === 0) {
      filtered = filtered.filter(p => p.service_category?.main_category_id === cat);
    }

    // Ordenamiento
    if (this.selectedFilter() === 'distance') {
      filtered.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
    } else {
      filtered.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
    }

    this.filteredProviders.set(filtered);
    this.searchState.setProviders(filtered);
  }

  getIconEmoji(icon: string | null | undefined, name: string): string {
    const ICON_MAP: Record<string, string> = {
      'hammer': '🔨', 'construct': '🏗️', 'build': '🔧',
      'water': '🚿', 'flash': '⚡', 'leaf': '🌿',
      'sparkles': '✨', 'paw': '🐾', 'cut': '✂️',
      'medkit': '💊', 'school': '📚', 'car': '🚗',
      'calendar': '📅', 'laptop': '💻', 'restaurant': '🍽️',
    };
    if (!icon) return '🔨';
    const iconLower = icon.toLowerCase();
    if (ICON_MAP[iconLower]) return ICON_MAP[iconLower];
    if (icon.startsWith('http://') || icon.startsWith('https://')) return '';
    return '🔨';
  }

  isImageUrl(icon: string | null | undefined): boolean {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://');
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = img.nextElementSibling as HTMLElement;
    if (img && fallback) {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    }
  }

  /**
   * En touch (móvil): primer tap destaca el pin en el mapa (visible detrás del sidebar).
   * Segundo tap sobre la card ya activa navega al perfil (routerLink actúa normal).
   * En desktop con hover real no interceptamos nada.
   */
  onCardClick(event: Event, providerId: number): void {
    if (this.isMobile()) {
      // En móvil: toggle highlight del pin en el mapa
      // La navegación está deshabilitada vía [routerLink]=null
      this.hoveredProviderId.set(
        this.hoveredProviderId() === providerId ? null : providerId
      );
    }
  }

  trackById(_: number, item: ServiceProvider) { return item.id; }
}
