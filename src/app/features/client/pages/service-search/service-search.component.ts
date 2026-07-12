import { Component, inject, signal, computed, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, take, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SearchStateService } from '../../../../core/services/search-state.service';
import { LocationService } from '../../../../core/services/location.service';
import { ServiceProvider, MainCategory } from '../../../../core/models/provider.model';

export type LockedProvider = ServiceProvider & { locked: boolean };
import { ServiceMapComponent } from '../service-map/service-map.component';
import { ContactLimitService } from '../../../../core/services/contact-limit.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-service-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ServiceMapComponent],
  templateUrl: './service-search.component.html',
  styleUrl: './service-search.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ServiceSearchComponent implements OnInit {
  private readonly fb           = inject(FormBuilder);
  private readonly providerSvc  = inject(ProviderService);
  private readonly categorySvc  = inject(CategoryService);
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly searchState  = inject(SearchStateService);
  private readonly locationSvc  = inject(LocationService);
  private readonly auth         = inject(AuthService);
  readonly contactLimit         = inject(ContactLimitService);
  readonly hasPremium = computed(() => {
    const currentUser = this.auth.currentUser();
    const profile = this.auth.currentProfile();
    return Boolean(currentUser?.has_premium || profile?.has_premium);
  });

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

  /** true cuando se accede desde /guest/service-search (sin autenticación) */
  readonly isGuestMode = signal(false);
  /** Controla el modal de registro que se levanta cuando un invitado toca una card de proveedor */
  readonly showGuestRegisterModal = signal(false);

  /** service_id dominante de la búsqueda actual (primero de la lista) */
  readonly currentServiceId = computed(() => this.serviceIds()[0] ?? 0);

  /**
   * Proveedores con flag `locked` calculado según reglas de negocio:
   * - Premium: nunca bloqueado
   * - Ya contactado en el service_id: desbloqueado
   * - Slots gratuitos restantes: desbloqueados en orden
   * - El resto: bloqueados
   */
  readonly visibleProviders = computed((): LockedProvider[] => {
    const providers = this.filteredProviders();
    if (this.hasPremium()) return providers.map(p => ({ ...p, locked: false }));

    // Mapa de slots restantes por service_id (se decrementa al asignar)
    const slotsMap = new Map<number, number>();

    return providers.map(p => {
      const svcId = p.service_id ?? 0;
      const contacted = new Set(this.contactLimit.contactedProviders(svcId));

      // Ya contactó a este proveedor → siempre visible
      if (contacted.has(p.provider_id)) return { ...p, locked: false };

      // Inicializar contador para este service_id si aún no existe
      if (!slotsMap.has(svcId)) {
        slotsMap.set(svcId, this.contactLimit.remaining(svcId));
      }

      const slots = slotsMap.get(svcId)!;
      if (slots > 0) {
        slotsMap.set(svcId, slots - 1);
        return { ...p, locked: false };
      }
      return { ...p, locked: true };
    });
  });

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
    // Detectar modo invitado según la URL actual
    this.isGuestMode.set(this.router.url.startsWith('/guest'));

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
      error: (err) => {
        if (this.handleBusinessLimitError(err)) {
          this.loading.set(false);
          return;
        }
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

    this.providerSvc.getNearbyProvidersByServiceIds(lat, lng, radius, serviceIds, 0, 60).pipe(
      catchError(err => {
        // Errores de límite de negocio → propagar para que el componente redirija al modal premium
        const code = (err as HttpErrorResponse)?.error?.detail?.code;
        if (code === 'DAILY_SEARCH_LIMIT_REACHED' || code === 'FREE_SERVICE_SELECTION_LIMIT') {
          throw err;
        }
        // Endpoint unificado no disponible (ej. aún no desplegado) → fallback individual
        const detail = (err as HttpErrorResponse)?.error?.detail;
        console.warn('Endpoint unificado no disponible, usando fallback individual', err?.status, detail);
        const requests = serviceIds.map(id =>
          this.providerSvc.getNearbyProvidersByServiceId(lat, lng, radius, id, 0, 20)
        );
        return forkJoin(requests.length ? requests : [of([])]).pipe(
          catchError(() => of([] as ServiceProvider[][])),
        ).pipe(
          // forkJoin devuelve ServiceProvider[][] → aplanar
          catchError(() => of([] as ServiceProvider[])),
        );
      })
    ).subscribe({
      next: (results: ServiceProvider[] | ServiceProvider[][]) => {
        const flat: ServiceProvider[] = Array.isArray(results[0])
          ? this.removeDuplicates((results as ServiceProvider[][]).flat())
          : this.removeDuplicates(results as ServiceProvider[]);
        this.providers.set(flat);
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
      error: (err) => {
        if (this.handleBusinessLimitError(err)) {
          this.loading.set(false);
          return;
        }
        this.error.set('Error al cargar proveedores.');
        this.loading.set(false);
      }
    });
  }

  private handleBusinessLimitError(err?: unknown): boolean {
    const httpErr = err as HttpErrorResponse | undefined;
    const code = httpErr?.error?.detail?.code;
    if (code === 'DAILY_SEARCH_LIMIT_REACHED' || code === 'FREE_SERVICE_SELECTION_LIMIT') {
      const categoriesPath = this.isGuestMode() ? '/guest/categories' : '/client/tabs/categories';
      this.router.navigate([categoriesPath], {
        queryParams: { premium_reason: code },
        replaceUrl: true,
      });
      return true;
    }
    return false;
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
   * En modo invitado: siempre muestra modal de registro.
   */
  onCardClick(event: Event, providerId: number): void {
    // Modo invitado: bloquear navegación y mostrar modal de registro
    if (this.isGuestMode()) {
      event.preventDefault();
      event.stopPropagation();
      this.showGuestRegisterModal.set(true);
      return;
    }

    // Highlight del pin en el mapa independientemente del dispositivo
    this.hoveredProviderId.set(
      this.hoveredProviderId() === providerId ? null : providerId
    );
  }

  closeGuestRegisterModal(): void {
    this.showGuestRegisterModal.set(false);
  }

  navigateToRegister(): void {
    this.router.navigate(['/auth/login'], { queryParams: { tab: 'register' } });
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login'], { queryParams: { tab: 'login' } });
  }

  goToPremium(): void {
    const filters = this.searchState.filters();
    let returnPath = '/client/tabs/service-search';

    // Incluir los params de búsqueda activos para reconstruir la búsqueda al volver
    if (filters.service_ids?.length) {
      const ids = filters.service_ids.join(',');
      const names = (filters.service_names ?? []).map(s => s.name).join(',');
      const params = new URLSearchParams({ service_ids: ids });
      if (names) params.set('service_names', names);
      returnPath += '?' + params.toString();
    }

    this.router.navigate(['/payment'], {
      queryParams: {
        product_type: 'CLIENT_UNLOCK_7',
        returnTo: returnPath
      }
    });
  }

  trackById(_: number, item: ServiceProvider) { return item.id; }
}
