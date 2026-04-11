import { Component, signal, OnDestroy, inject, ElementRef, ViewChild, AfterViewInit, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProviderService } from '../../../../core/services/provider.service';
import { ServiceProvider } from '../../../../core/models/provider.model';
import { SearchStateService } from '../../../../core/services/search-state.service';
import { LocationService } from '../../../../core/services/location.service';

type MapStyle = 'streets' | 'light' | 'dark';

@Component({
  selector: 'app-service-map',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './service-map.component.html',
  styleUrls: ['./service-map.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ServiceMapComponent implements OnDestroy, AfterViewInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private readonly providerSvc = inject(ProviderService);
  private readonly searchState = inject(SearchStateService);
  private readonly locationSvc = inject(LocationService);

  nearbyProviders = signal<ServiceProvider[]>([]);
  loading         = signal(true);
  locationError   = signal('');
  selectedStyle   = signal<MapStyle>('streets');
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
      if (val.length > 0) {
        this.addProviderMarkers(val);
        // Actualizar marcador de ubicación si hay una selección guardada
        const selectedLocation = this.locationSvc.getSelectedLocation();
        if (selectedLocation) {
          this.updateUserMarker(selectedLocation.lat, selectedLocation.lon);
          this.map?.setView([selectedLocation.lat, selectedLocation.lon], 13);
        }
      }
    }
  }
  get embeddedProviders(): ServiceProvider[] | null { return this._embeddedProviders; }

  private _embeddedProviders: ServiceProvider[] | null = null;
  private mapReady = false;
  private map: any = null;
  private markerClusterGroup: any = null;
  private userMarker: any = null;
  private L: any = null;

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

      // Crear mapa
      this.map = this.L.map(this.mapContainer.nativeElement, {
        zoomControl: true,
        zoom: 12,
        center: [-33.45, -70.67]
      });

      // Agregar capa de tiles con el estilo seleccionado
      this.applyMapStyle(this.selectedStyle());

      // Crear grupo de clustering (ahora markerClusterGroup estará disponible)
      this.markerClusterGroup = (this.L as any).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let className = 'marker-cluster-small';
          if (count > 10) className = 'marker-cluster-medium';
          if (count > 30) className = 'marker-cluster-large';
          
          return this.L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster ${className}`,
            iconSize: this.L.point(40, 40)
          });
        }
      });
      this.map.addLayer(this.markerClusterGroup);

      // Habilitar selección manual de ubicación haciendo clic en el mapa
      this.map.on('click', (e: any) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        this.updateUserMarker(lat, lng);
        this.locationSvc.setSelectedLocation({
          text: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          place_name: 'Ubicación personalizada',
          lat: lat,
          lon: lng
        });
        console.log('📍 Ubicación seleccionada manualmente:', lat, lng);
      });

      // Mapa listo — verificar si ya hay proveedores inyectados por el padre
      this.mapReady = true;

      if (this._embeddedProviders != null) {
        // Input ya llegó antes de que el mapa estuviera listo → aplicar ahora
        this.nearbyProviders.set(this._embeddedProviders);
        this.loading.set(false);
        if (this._embeddedProviders.length > 0) this.addProviderMarkers(this._embeddedProviders);
        return;
      }

      if (this.embedded) {
        // Modo embebido pero sin datos todavía → esperar input
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
          <small>Lng: ${lng.toFixed(4)}</small><br>
          <small class="text-blue-600 mt-1 block">ℹ️ Haz clic en el mapa para cambiar</small>
        </div>
      `);
    } else {
      // Crear nuevo marcador
      this.userMarker = this.L.marker([lat, lng], { icon: userIcon, draggable: true })
        .addTo(this.map)
        .bindPopup(`
          <div class="user-popup">
            <strong>Tu ubicación</strong><br>
            <small>Lat: ${lat.toFixed(4)}</small><br>
            <small>Lng: ${lng.toFixed(4)}</small><br>
            <small class="text-blue-600 mt-1 block">ℹ️ Haz clic en el mapa para cambiar</small>
          </div>
        `);

      // Permitir arrastrar el marcador para cambiar ubicación
      this.userMarker.on('dragend', (e: any) => {
        const newPos = e.target.getLatLng();
        this.locationSvc.setSelectedLocation({
          text: `${newPos.lat.toFixed(4)}, ${newPos.lng.toFixed(4)}`,
          place_name: 'Ubicación personalizada',
          lat: newPos.lat,
          lon: newPos.lng
        });
        console.log('📍 Ubicación arrastrada a:', newPos.lat, newPos.lng);
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
          .bindPopup(this.createProviderPopup(p, isLocked));

        // Click solo si no está bloqueado
        marker.on('click', () => {
          if (isLocked) {
            alert('⭐ Accede a plan Premium para ver más proveedores');
          }
        });

        this.markerClusterGroup.addLayer(marker);
      }
    });

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

    return `
      <div class="provider-popup">
        <div class="popup-header">
          <strong>${lockIcon}${provider.business_name || provider.full_name}</strong>
          ${rating > 0 ? `<div class="rating">${stars} ${rating.toFixed(1)}</div>` : '<div class="rating-new">Nuevo</div>'}
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
