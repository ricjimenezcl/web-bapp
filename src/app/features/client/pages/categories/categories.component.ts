import { Component, inject, signal, OnInit, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../../../core/services/category.service';
import { LocationService, LocationSuggestion } from '../../../../core/services/location.service';
import { MainCategory, ServiceCategory } from '../../../../core/models/provider.model';
import { MapPickerComponent } from '../../../../shared/components/map-picker/map-picker.component';
import { AuthService } from '../../../../core/services/auth.service';
import { ProductType } from '../../../../core/services/payment.service';
import { ModalService } from '../../../../core/services/modal.service';
import { PlatformI18nService } from '../../../../core/services/platform-i18n.service';
import { TPipe } from '../../../../shared/pipes/t.pipe';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, MapPickerComponent, TPipe],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CategoriesComponent implements OnInit {
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);
  private readonly categorySvc = inject(CategoryService);
  private readonly locationSvc = inject(LocationService);
  private readonly auth        = inject(AuthService);
  private readonly modal       = inject(ModalService);
  private readonly i18n        = inject(PlatformI18nService);

  /** true cuando se accede desde /guest/categories (sin autenticación) */
  readonly isGuestMode = signal(false);

  categories = signal<MainCategory[]>([]);
  allCategories = signal<ServiceCategory[]>([]);
  loading    = signal(true);
  
  // Para manejo de subcategorías
  selectedMainCategory = signal<MainCategory | null>(null);
  subcategories = signal<ServiceCategory[]>([]);
  selectedServices = signal<ServiceCategory[]>([]);
  showSubcategories = signal(false);
  page = signal(1);
  readonly pageSize = 10;
  pagedServices = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.subcategories().slice(start, start + this.pageSize);
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.subcategories().length / this.pageSize)));

  // Search functionality
  searchQuery = signal('');
  filteredCategories = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (query.length < 2) return [];
    return this.allCategories().filter(cat => 
      cat.name.toLowerCase().includes(query) || 
      cat.description?.toLowerCase().includes(query)
    ).slice(0, 8);
  });

  // Location functionality
  showLocationSearch = false;
  locationQuery = '';
  locationSuggestions: LocationSuggestion[] = [];
  selectedLocationName = this.i18n.t('categories.currentLocation');
  isLocationSearching = false;
  private locationSearchTimeout?: ReturnType<typeof setTimeout>;

  // Map picker functionality
  showMapPicker = signal(false);

  // Premium / limits
  showPremiumModal = signal(false);
  premiumModalReason = signal<'DAILY_SEARCH_LIMIT_REACHED' | 'FREE_SERVICE_SELECTION_LIMIT' | null>(null);
  readonly freeDailySearchLimit = 3;
  readonly maxFreeServices = 3;
  readonly hasPremium = computed(() => {
    const currentUser = this.auth.currentUser();
    const profile = this.auth.currentProfile();
    return Boolean(currentUser?.has_premium || profile?.has_premium);
  });
  readonly premiumModalTitle = computed(() => {
    const reason = this.premiumModalReason();
    if (reason === 'DAILY_SEARCH_LIMIT_REACHED') {
      return this.i18n.t('categories.premium.dailyLimitTitle');
    }
    if (reason === 'FREE_SERVICE_SELECTION_LIMIT') {
      return this.i18n.t('categories.premium.serviceLimitTitle');
    }
    return this.i18n.t('categories.premium.unlockTitle');
  });
  readonly premiumModalSub = computed(() => {
    const reason = this.premiumModalReason();
    if (reason === 'DAILY_SEARCH_LIMIT_REACHED') {
      return this.i18n.t('categories.premium.dailyLimitBody')
        .replace('{limit}', String(this.freeDailySearchLimit));
    }
    if (reason === 'FREE_SERVICE_SELECTION_LIMIT') {
      return this.i18n.t('categories.premium.serviceLimitBody')
        .replace('{limit}', String(this.maxFreeServices));
    }
    return this.i18n.t('categories.premium.unlockBody')
      .replace('{daily}', String(this.freeDailySearchLimit))
      .replace('{services}', String(this.maxFreeServices));
  });

  private readonly EMOJI_MAP: Record<string, string> = {
    // Por nombre (español)
    'construcción': '🏗️', 'plomería': '🚿', 'fontanería': '🚿',
    'electricidad': '⚡', 'carpintería': '🪵', 'jardinería': '🌿',
    'limpieza': '🧹', 'mascotas': '🐾', 'reparaciones': '🔧',
    'belleza': '💇', 'salud': '💊', 'educación': '📚',
    'transporte': '🚗', 'eventos': '🎉', 'tecnología': '💻',
    'alimentos': '🍽️',
    // Por nombres de Ionic Icons (del backend)
    'hammer': '🔨', 'construct': '🏗️', 'build': '🔧',
    'water': '🚿', 'flash': '⚡', 'leaf': '🌿',
    'sparkles': '✨', 'paw': '🐾', 'cut': '✂️',
    'medkit': '💊', 'school': '📚', 'car': '🚗',
    'calendar': '📅', 'laptop': '💻', 'restaurant': '🍽️',
  };

  ngOnInit(): void {
    console.log('🎯 CategoriesComponent - ngOnInit');

    // Detectar modo invitado según la URL actual
    this.isGuestMode.set(this.router.url.startsWith('/guest'));

    const premiumReason = this.route.snapshot.queryParamMap.get('premium_reason');
    if (!this.hasPremium() && (premiumReason === 'DAILY_SEARCH_LIMIT_REACHED' || premiumReason === 'FREE_SERVICE_SELECTION_LIMIT')) {
      this.openPremiumModal(premiumReason);
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { premium_reason: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    // Cargar categorías principales
    this.categorySvc.getMainCategories().subscribe({
      next: cats => { 
        console.log('📋 Categorías principales cargadas:', cats.length);
        this.categories.set(cats); 
        this.loading.set(false); 
      },
      error: () => this.loading.set(false),
    });

    // Cargar todas las categorías de servicios para autocomplete
    this.categorySvc.getServices().subscribe({
      next: services => {
        console.log('📦 Servicios cargados para autocomplete:', services.length);
        this.allCategories.set(services);
      },
      error: (err) => console.error('Error cargando servicios:', err)
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEARCH FUNCTIONALITY
  // ══════════════════════════════════════════════════════════════════════════

  onSearchInput(value: string): void {
    // Actualizar el signal para disparar el computed
    this.searchQuery.set(value);
  }

  selectServiceCategory(cat: ServiceCategory): void {
    console.log('✅ Servicio seleccionado desde autocomplete:', cat.name);
    this.searchQuery.set('');
    const targetPath = this.isGuestMode() ? '/guest/service-search' : '/client/tabs/service-search';
    // Navegar directamente a búsqueda con este servicio
    this.router.navigate([targetPath], {
      queryParams: { service_ids: cat.id.toString(), service_names: cat.name },
      replaceUrl: true
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOCATION FUNCTIONALITY
  // ══════════════════════════════════════════════════════════════════════════

  toggleLocationSearch(): void {
    this.showLocationSearch = !this.showLocationSearch;
    if (!this.showLocationSearch) {
      this.locationQuery = '';
      this.locationSuggestions = [];
    }
  }

  onLocationInput(): void {
    const query = this.locationQuery.trim();
    
    // Limpiar timeout anterior
    if (this.locationSearchTimeout) {
      clearTimeout(this.locationSearchTimeout);
    }

    if (query.length < 2) {
      this.locationSuggestions = [];
      this.isLocationSearching = false;
      return;
    }

    this.isLocationSearching = true;

    // Debounce de 350ms antes de llamar a la API
    this.locationSearchTimeout = globalThis.setTimeout(() => {
      // Llamada a API real de geolocalización (Geoapify)
      this.locationSvc.searchLocations(query).subscribe({
        next: (suggestions) => {
          this.locationSuggestions = suggestions;
          this.isLocationSearching = false;
        },
        error: (err) => {
          console.error('Error buscando ubicaciones:', err);
          this.locationSuggestions = [];
          this.isLocationSearching = false;
        }
      });
    }, 350);
  }

  selectLocation(suggestion: LocationSuggestion): void {
    console.log('📍 Ubicación seleccionada:', suggestion.text, `(${suggestion.lat}, ${suggestion.lon})`);
    this.selectedLocationName = suggestion.text;
    this.showLocationSearch = false;
    this.locationQuery = '';
    this.locationSuggestions = [];
    // Guardar coordenadas en LocationService para filtrar proveedores cercanos
    this.locationSvc.setSelectedLocation(suggestion);
  }

  clearLocation(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedLocationName = this.i18n.t('categories.currentLocation');
    this.locationSvc.clearSelectedLocation();
  }

  openMapPicker(): void {
    console.log('🗺️ Abriendo map picker');
    this.showMapPicker.set(true);
    this.showLocationSearch = false; // Cerrar el dropdown de búsqueda si está abierto
  }

  onLocationSelected(suggestion: LocationSuggestion): void {
    console.log('📍 Ubicación seleccionada desde mapa:', suggestion.text, `(${suggestion.lat}, ${suggestion.lon})`);
    this.selectedLocationName = suggestion.text;
    this.locationSvc.setSelectedLocation(suggestion);
    this.showMapPicker.set(false);
  }

  onMapPickerClose(): void {
    console.log('🗺️ Cerrando map picker');
    this.showMapPicker.set(false);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY & SERVICE SELECTION
  // ══════════════════════════════════════════════════════════════════════════

  getEmoji(name: string): string {
    const lower = name.toLowerCase();
    for (const [key, emoji] of Object.entries(this.EMOJI_MAP)) {
      if (lower.includes(key)) return emoji;
    }
    return '🔨';
  }

  getIconEmoji(icon: string | null | undefined, name: string): string {
    if (!icon) return this.getEmoji(name);
    // Si el icon es un nombre de Ionic Icon, mapearlo a emoji
    const iconLower = icon.toLowerCase();
    if (this.EMOJI_MAP[iconLower]) {
      return this.EMOJI_MAP[iconLower];
    }
    // Si es una URL de imagen, no retornarla aquí (se maneja en HTML)
    if (icon.startsWith('http://') || icon.startsWith('https://')) {
      return ''; // El HTML usará <img> en su lugar
    }
    // Fallback: usar el nombre de la categoría
    return this.getEmoji(name);
  }

  isImageUrl(icon: string | null | undefined): boolean {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://');
  }

  select(cat: MainCategory): void {
    console.log('✅ Categoría seleccionada:', cat.name, 'ID:', cat.id);
    this.selectedMainCategory.set(cat);
    this.selectedServices.set([]);
    this.loading.set(true);
    this.showSubcategories.set(true);
    
    // Cargar subcategorías (servicios específicos) de la categoría seleccionada
    this.categorySvc.getCategoryWithServices(cat.id).subscribe({
      next: (categoryWithServices) => {
        console.log('📦 Subcategorías cargadas:', categoryWithServices.services?.length || 0);
        this.subcategories.set(categoryWithServices.services || []);
        this.page.set(1);
        this.loading.set(false);
      },
      error: () => {
        // Si falla, cargar usando el otro endpoint
        this.categorySvc.getServices({ category_id: cat.id }).subscribe({
          next: (services) => {
            this.subcategories.set(services);
            this.page.set(1);
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      }
    });
  }

  back(): void {
    this.showSubcategories.set(false);
    this.selectedMainCategory.set(null);
    this.selectedServices.set([]);
    this.page.set(1);
  }

  async cancelSearch(): Promise<void> {
    if (this.isGuestMode()) {
      await this.router.navigate(['/auth/login']);
      return;
    }
    const confirmed = await this.modal.confirm(
      this.i18n.t('categories.cancelConfirm.body'),
      this.i18n.t('categories.cancelConfirm.title'),
      this.i18n.t('common.yes'),
      this.i18n.t('common.no')
    );

    if (confirmed) {
      await this.router.navigate(['/client/tabs/profile']);
    }
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
    }
  }

  toggleService(service: ServiceCategory): void {
    const current = this.selectedServices();
    const index = current.findIndex(s => s.id === service.id);
    if (index >= 0) {
      this.selectedServices.set(current.filter(s => s.id !== service.id));
    } else {
      if (!this.hasPremium() && current.length >= this.maxFreeServices) {
        this.openPremiumModal('FREE_SERVICE_SELECTION_LIMIT');
        return;
      }
      this.selectedServices.set([...current, service]);
    }
  }

  isServiceSelected(service: ServiceCategory): boolean {
    return this.selectedServices().some(s => s.id === service.id);
  }

  confirmSelection(): void {
    const selected = this.selectedServices();
    console.log('👉 confirmSelection - Servicios seleccionados:', selected.length, selected.map(s => s.id));
    if (selected.length === 0) {
      console.warn('⚠️ No hay servicios seleccionados');
      return;
    }

    const targetPath = this.isGuestMode() ? '/guest/service-search' : '/client/tabs/service-search';
    // Navegar con los IDs y nombres de servicios seleccionados
    const serviceIds   = selected.map(s => s.id).join(',');
    const serviceNames = selected.map(s => s.name).join(',');
    console.log('🧭 Navegando a service-search con IDs:', serviceIds);
    this.router.navigate([targetPath], {
      queryParams: { service_ids: serviceIds, service_names: serviceNames },
      replaceUrl: true
    });
  }

  skip(): void {
    const targetPath = this.isGuestMode() ? '/guest/service-search' : '/client/tabs/service-search';
    this.router.navigate([targetPath], { replaceUrl: true });
  }

  openPremiumModal(reason: 'DAILY_SEARCH_LIMIT_REACHED' | 'FREE_SERVICE_SELECTION_LIMIT' | null = null): void {
    this.premiumModalReason.set(reason);
    this.showPremiumModal.set(true);
  }

  freePlanLimitsText(): string {
    return this.i18n.t('categories.freePlanLimits')
      .replace('{daily}', String(this.freeDailySearchLimit))
      .replace('{services}', String(this.maxFreeServices));
  }

  pageInfoText(): string {
    return this.i18n.t('common.pageOf')
      .replace('{page}', String(this.page()))
      .replace('{total}', String(this.totalPages()));
  }

  freeSelectionCapText(): string {
    return this.i18n.t('categories.freeSelectionCap')
      .replace('{limit}', String(this.maxFreeServices));
  }

  selectedServicesSummaryText(): string {
    return this.i18n.t('categories.selectedServicesCount')
      .replace('{count}', String(this.selectedServices().length));
  }

  closePremiumModal(): void {
    this.showPremiumModal.set(false);
    this.premiumModalReason.set(null);
  }
  choosePremiumPlan(productType: ProductType): void {
    this.closePremiumModal();
    // returnTo apunta de vuelta a categories para mantener el contexto de selección
    const targetCategories = this.isGuestMode() ? '/guest/categories' : '/client/tabs/categories';
    this.router.navigate(['/payment'], {
      state: {
        product_type: productType,
        returnTo: targetCategories
      }
    });
  }

}
