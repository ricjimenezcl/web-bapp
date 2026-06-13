import { Component, signal, OnDestroy, inject, ElementRef, ViewChild, AfterViewInit, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProviderService } from '../../../../core/services/provider.service';
import { ServiceProvider } from '../../../../core/models/provider.model';
import { SearchStateService } from '../../../../core/services/search-state.service';
import { LocationService } from '../../../../core/services/location.service';
import { ModalService } from '../../../../core/services/modal.service';

type MapStyle = 'streets' | 'light' | 'dark';

@Component({
  selector: 'app-service-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-map.component.html',
  styleUrls: ['./service-map.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ServiceMapComponent implements OnDestroy, AfterViewInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private readonly providerSvc = inject(ProviderService);
  private readonly searchState = inject(SearchStateService);
  private readonly locationSvc = inject(LocationService);
  private readonly modal = inject(ModalService);

  nearbyProviders = signal<ServiceProvider[]>([]);
  loading         = signal(true);
  locationError   = signal('');
  selectedStyle   = signal<MapStyle>('light');
  freeProviderLimit = 5; // Plan gratuito: 5 proveedores accesibles

  /** Cuando se usa embebido dentro de service-search */
  @Input() embedded = false;

  /** Proveedores inyectados desde el padre (service-search fused view) */
  @Input()
  set embeddedProviders(val: ServiceProvider[] | null | undefined) {
    this._embeddedProviders = val ?? null;
    if (val != null && this.mapReady) {
      this.nearbyProviders.set(val);
      this.loading.set(false);
      this.markerClusterGroup?.clearLayers();
      this.providerMarkers.clear();
      if (val.length > 0) {
        this.addProviderMarkers(val);
        // Mostrar marcador de ubicación del usuario en el mapa embebido
        const selectedLocation = this.locationSvc.getSelectedLocation();
        if (selectedLocation) {
          this.updateUserMarker(selectedLocation.lat, selectedLocation.lon);
          this.map?.setView([selectedLocation.lat, selectedLocation.lon], 13);
        } else {
          // Fallback: ubicación guardada en estado (ej: geolocalización del navegador)
          const stateLocation = this.searchState.userLocation();
          if (stateLocation) {
            this.updateUserMarker(stateLocation.lat, stateLocation.lng);
          }
        }
      }
    }
  }
  get embeddedProviders(): ServiceProvider[] | null { return this._embeddedProviders; }

  /** Provider id actualmente resaltado (sincronizado con hover de card en service-search) */
  @Input()
  set highlightedProviderId(id: number | null | undefined) {
    const next = id ?? null;
    if (next === this._highlightedId) return;
    this.applyHighlight(this._highlightedId, false);
    this._highlightedId = next;
    this.applyHighlight(next, true);
  }
  get highlightedProviderId(): number | null { return this._highlightedId; }

  private _embeddedProviders: ServiceProvider[] | null = null;
  private _highlightedId: number | null = null;
  private mapReady = false;
  private map: any = null;
  private markerClusterGroup: any = null;
  private userMarker: any = null;
  private L: any = null;
  /** Markers indexados por provider_id (o id) para sincronizar highlight con la lista */
  private providerMarkers = new Map<number, any>();

  ngAfterViewInit(): void {
    this.initMap();
  }

  private async initMap(): Promise<void> {
    try {
      // Importar Leaflet primero
      const L = await import('leaflet');
      this.L = L.default || L;
      
      // Importar MarkerCluster después (extiende L automáticamente)
      await import('leaflet.markercluster');

      // Configurar íconos por defecto
      delete this.L.Icon.Default.prototype._getIconUrl;
      this.L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Fix responsive: invalidar tamaño del mapa después de renderizar
      // Esto asegura que el mapa cargue correctamente en mobile
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 300);

      // Crear mapa
      this.map = this.L.map(this.mapContainer.nativeElement, {
        zoomControl: true,
        zoom: 12,
        center: [-33.45, -70.67]
      });

      // Agregar capa de tiles con el estilo seleccionado
      this.applyMapStyle(this.selectedStyle());

      // Grupo de marcadores sin clustering — cada pin siempre visible e independiente
      this.markerClusterGroup = (this.L as any).markerClusterGroup({
        maxClusterRadius: 0,          // radio 0 → nunca agrupa
        disableClusteringAtZoom: 0,   // desactiva clustering desde el zoom mínimo
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
      });
      this.map.addLayer(this.markerClusterGroup);

      // FIX: El marcador del usuario NO debe moverse al hacer click
      // Eliminamos la lógica que actualizaba el marker al hacer click en el mapa
      // Ahora solo se permite drag si el usuario lo desea, pero no el click

      // Mapa listo — verificar si ya hay proveedores inyectados por el padre
      this.mapReady = true;

      if (this._embeddedProviders != null) {
        // Input ya llegó antes de que el mapa estuviera listo → aplicar ahora
        this.nearbyProviders.set(this._embeddedProviders);
        this.loading.set(false);
        if (this._embeddedProviders.length > 0) {
          this.addProviderMarkers(this._embeddedProviders);
          // Colocar marcador de usuario
          const selectedLocation = this.locationSvc.getSelectedLocation();
          if (selectedLocation) {
            this.updateUserMarker(selectedLocation.lat, selectedLocation.lon);
            this.map?.setView([selectedLocation.lat, selectedLocation.lon], 13);
          } else {
            const stateLocation = this.searchState.userLocation();
            if (stateLocation) {
              this.updateUserMarker(stateLocation.lat, stateLocation.lng);
            }
          }
        }
        return;
      }

      if (this.embedded) {
        // Modo embebido pero sin datos todavía → esperar input
        // Precargar marcador de usuario si ya hay ubicación disponible
        const selectedLocation = this.locationSvc.getSelectedLocation();
        if (selectedLocation) {
          this.map.setView([selectedLocation.lat, selectedLocation.lon], 13);
          this.createUserMarker(selectedLocation.lat, selectedLocation.lon);
        } else {
          const stateLocation = this.searchState.userLocation();
          if (stateLocation) {
            this.map.setView([stateLocation.lat, stateLocation.lng], 13);
            this.createUserMarker(stateLocation.lat, stateLocation.lng);
          }
        }
        this.loading.set(false);
        return;
      }

      // Modo standalone: verificar estado guardado o cargar desde geolocalización
      const stateProviders = this.searchState.providers();
      const stateLocation = this.searchState.userLocation();
      const selectedLocation = this.locationSvc.getSelectedLocation();

      // Priorizar ubicación seleccionada manualmente sobre estado guardado
      if (selectedLocation) {
        this.map.setView([selectedLocation.lat, selectedLocation.lon], 13);
        this.createUserMarker(selectedLocation.lat, selectedLocation.lon);
        if (stateProviders.length > 0) {
          this.nearbyProviders.set(stateProviders);
          this.loading.set(false);
          this.addProviderMarkers(stateProviders);
        } else {
          this.loadNearbyProviders(selectedLocation.lat, selectedLocation.lon);
        }
      } else if (this.searchState.hasSearched() && stateProviders.length > 0) {
        this.nearbyProviders.set(stateProviders);
        this.loading.set(false);
        if (stateLocation) {
          this.map.setView([stateLocation.lat, stateLocation.lng], 14);
          this.createUserMarker(stateLocation.lat, stateLocation.lng);
        }
        this.addProviderMarkers(stateProviders);
      } else {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              this.map.setView([lat, lng], 14);
              this.createUserMarker(lat, lng);
              this.loadNearbyProviders(lat, lng);
            },
            () => {
              this.locationError.set('No se pudo obtener tu ubicación. Mostrando Santiago.');
              this.loadNearbyProviders(-33.45, -70.67);
            }
          );
        } else {
          this.loadNearbyProviders(-33.45, -70.67);
        }
      }
    } catch (e) {
      console.error('Error al inicializar el mapa:', e);
      this.loading.set(false);
      this.locationError.set('Error al cargar el mapa.');
    }
  }

  /**
   * Crear o actualizar marcador de usuario con animación de pulso
   */
  private createUserMarker(lat: number, lng: number): void {
    if (!this.L) return;
    
    // Crear ícono de ubicación actual con imagen personalizada (PNG para mejor compatibilidad)
    const userIcon = this.L.icon({
      iconUrl: 'https://res.cloudinary.com/dghwotofx/image/upload/f_png,w_64,h_64/v1774631660/ubicacion_nbo2mo',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: 'user-location-icon'
    });

    if (this.userMarker) {
      // Actualizar posición del marcador existente
      this.userMarker.setLatLng([lat, lng]);
      this.userMarker.setPopupContent(`
        <div class="user-popup">
          <strong>Tu ubicación</strong><br>
          <small>Lat: ${lat.toFixed(4)}</small><br>
          <small>Lng: ${lng.toFixed(4)}</small>
        </div>
      `);
    } else {
      // Crear nuevo marcador - NO draggable, NO interactive
      this.userMarker = this.L.marker([lat, lng], { 
        icon: userIcon, 
        draggable: false,
        interactive: false,
        autoPan: true,
        panOnPopupOpen: true
      })
        .addTo(this.map)
        .bindPopup(`
          <div class="user-popup">
            <strong>Tu ubicación</strong><br>
            <small>Lat: ${lat.toFixed(4)}</small><br>
            <small>Lng: ${lng.toFixed(4)}</small>
          </div>
        `, {
          maxWidth: 200,
          autoPan: true,
          keepInView: true
        });
    }
  }

  /**
   * Actualizar marcador de usuario (wrapper sobre createUserMarker)
   */
  private updateUserMarker(lat: number, lng: number): void {
    this.createUserMarker(lat, lng);
  }

  /**
   * Agregar marcadores de proveedores con clustering
   */
  private addProviderMarkers(providers: ServiceProvider[]): void {
    if (!this.markerClusterGroup || !this.L) return;

    // Limpiar marcadores existentes
    this.markerClusterGroup.clearLayers();
    this.providerMarkers.clear();

    providers.forEach((p: ServiceProvider, index: number) => {
      if (p.latitude && p.longitude) {
        const isLocked = index >= this.freeProviderLimit;

        // Crear ícono de proveedor con imagen personalizada (PNG para mejor compatibilidad)
        const providerIcon = this.L.icon({
          iconUrl: 'https://res.cloudinary.com/dghwotofx/image/upload/f_png,w_56,h_56/v1774631660/proveedor_y6k7il',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -28],
          className: `provider-location-icon ${isLocked ? 'locked' : ''}`
        });

        const marker = this.L.marker([p.latitude, p.longitude], { icon: providerIcon })
          .bindPopup(this.createProviderPopup(p, isLocked), { 
            maxWidth: 250,
            autoPan: true,
            keepInView: true,
            closeButton: false,
          
          });

        // FIX mobile: asegurar que popup sea visible viewport
        marker.on('popupopen', () => {
          if (this.map) {
            const latlng = marker.getPopup().getLatLng();
            this.map.panTo([latlng.lat, latlng.lng], { animate: true });
          }
        });

        // Desktop: hover abre/cierra popup
        marker.on('mouseover', () => marker.openPopup());
        marker.on('mouseout',  () => {
          // No cerrar si es un provider bloqueado (el modal lo gestiona)
          if (!isLocked) marker.closePopup();
        });

        // Click / tap (funciona en desktop y móvil touch)
        marker.on('click', () => {
          if (isLocked) {
            marker.openPopup();
            this.modal.info('Accede a un plan Premium para desbloquear más proveedores.');
            return;
          }
          // Toggle popup en click/tap
          if (marker.isPopupOpen()) {
            marker.closePopup();
          } else {
            marker.openPopup();
          }
        });

        this.markerClusterGroup.addLayer(marker);

        // Indexar marcador por provider_id (o id) para sincronizar highlight con la lista
        const key = (p.provider_id ?? p.id) as number;
        if (key != null) this.providerMarkers.set(key, marker);
      }
    });

    // Re-aplicar highlight si había uno activo antes del refresh
    if (this._highlightedId != null) this.applyHighlight(this._highlightedId, true);

    // Ajustar vista del mapa para mostrar todos los marcadores
    if (providers.some(p => p.latitude && p.longitude)) {
      const bounds = this.L.latLngBounds(
        providers
          .filter(p => p.latitude && p.longitude)
          .map(p => [p.latitude!, p.longitude!])
      );
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  /**
   * Activa/desactiva la clase `marker-highlighted` sobre el ícono del marker
   * cuyo id coincide con `id`. La animación visual se define en SCSS.
   */
  private applyHighlight(id: number | null, on: boolean): void {
    if (id == null) return;
    const marker = this.providerMarkers.get(id);
    if (!marker) return;
    const el: HTMLElement | null = marker.getElement?.() ?? null;
    if (!el) return;
    el.classList.toggle('marker-highlighted', on);
    if (on) marker.openPopup(); else marker.closePopup();
  }

  /**
   * Crear contenido HTML del popup del proveedor
   */
  private createProviderPopup(provider: ServiceProvider, isLocked: boolean): string {
    // Asegurar que rating sea un número válido
    const rating = Number(provider.rating_avg) || 0;
    const stars = '⭐'.repeat(Math.round(rating));
    
    // Asegurar que distance_km y hourly_rate sean números
    const distanceNum = Number(provider.distance_km);
    const distance = distanceNum > 0 ? `${distanceNum.toFixed(1)} km` : 'N/A';
    const hourlyRateNum = Number(provider.hourly_rate);
    const hourlyRate = hourlyRateNum > 0 ? `$${hourlyRateNum.toLocaleString('es-CL')}` : 'Consultar';
    const lockIcon = isLocked ? '🔒 ' : '';

    const avatarHtml = provider.avatar
      ? `<img class="popup-avatar" src="${provider.avatar}" alt="${provider.business_name || provider.full_name}" />`
      : `<div class="popup-avatar popup-avatar--fallback"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>`;

    return `
      <div class="provider-popup">
        <div class="popup-header">
          ${avatarHtml}
          <div class="popup-header-info">
            <strong>${lockIcon}${provider.business_name || provider.full_name}</strong>
            ${rating > 0 ? `<div class="rating">${stars} ${rating.toFixed(1)}</div>` : '<div class="rating-new">Nuevo</div>'}
          </div>
        </div>
        <div class="popup-body">
          ${provider.service_category?.name ? `<p class="category">📂 ${provider.service_category.name}</p>` : ''}
          <p class="distance">📍 ${distance}</p>
          <p class="rate">💰 ${hourlyRate}/hr</p>
        </div>
        ${isLocked ? '<p class="locked-msg">⭐ Premium para acceder</p>' : `<a href="/client/provider-info/${provider.provider_id || provider.id}" class="popup-link">Ver perfil →</a>`}
      </div>
    `;
  }

  /**
   * Cargar proveedores cercanos desde la API
   */
  private async loadNearbyProviders(lat: number, lng: number): Promise<void> {
    this.providerSvc.getNearbyProviders(lat, lng, 20).subscribe({
      next: (providers) => {
        this.nearbyProviders.set(providers);
        this.loading.set(false);
        this.addProviderMarkers(providers);
        
        // Guardar en estado compartido
        this.searchState.setProviders(providers);
        this.searchState.setUserLocation(lat, lng);
      },
      error: () => { 
        this.loading.set(false);
        this.locationError.set('Error al cargar proveedores cercanos.');
      }
    });
  }

  /**
   * Cambiar estilo del mapa
   */
  changeMapStyle(style: MapStyle): void {
    this.selectedStyle.set(style);
    this.applyMapStyle(style);
  }

  /**
   * Aplicar estilo de mapa según selección
   */
  private applyMapStyle(style: MapStyle): void {
    if (!this.map) return;

    // Remover capa anterior
    this.map.eachLayer((layer: any) => {
      if (layer instanceof this.L.TileLayer) {
        this.map.removeLayer(layer);
      }
    });

    // Agregar nueva capa según estilo
    let tileUrl = '';
    let attribution = '© OpenStreetMap contributors';

    switch (style) {
      case 'streets':
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        break;
      case 'light':
        tileUrl = 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        attribution = '© CARTO, © OpenStreetMap contributors';
        break;
      case 'dark':
        tileUrl = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution = '© CARTO, © OpenStreetMap contributors';
        break;
    }

    this.L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(this.map);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
