import { Component, signal, OnDestroy, OnInit, inject, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { LocationService, LocationSuggestion } from '../../../core/services/location.service';
import { TPipe } from '../../pipes/t.pipe';
import { PlatformI18nService } from '../../../core/services/platform-i18n.service';

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './map-picker.component.html',
  styleUrls: ['./map-picker.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MapPickerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  
  @Output() locationSelected = new EventEmitter<LocationSuggestion>();
  @Output() closed = new EventEmitter<void>();
  
  @Input() initialLat = -33.4489;  // Santiago Centro por defecto
  @Input() initialLng = -70.6693;

  private readonly locationSvc = inject(LocationService);
  private readonly i18n = inject(PlatformI18nService);

  selectedAddress = signal('');
  loading = signal(true);
  locationError = signal('');

  private map: any = null;
  private L: any = null;
  private currentLat = -33.4489;
  private currentLng = -70.6693;
  
  // ✅ Debounce para reverse geocoding (previene rate limit)
  private readonly dragDebouncer$ = new Subject<{lat: number, lng: number}>();
  private readonly destroy$ = new Subject<void>();
  
  ngOnInit() {
    this.selectedAddress.set(this.i18n.t('mapPicker.loadingAddress'));
    // ✅ Setup debounced reverse geocoding
    this.dragDebouncer$.pipe(
      debounceTime(500),
      distinctUntilChanged((a, b) => 
        Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001
      ),
      takeUntil(this.destroy$)
    ).subscribe(({lat, lng}) => {
      console.log('[Debounced] Reverse geocoding:', lat, lng);
      this.updateAddressFromCoords(lat, lng);
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    // ✅ Cleanup de observables
    this.destroy$.next();
    this.destroy$.complete();
    this.dragDebouncer$.complete();
    
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private async initMap(): Promise<void> {
    try {
      // Importar Leaflet
      const L = await import('leaflet');
      this.L = L.default || L;

      // Configurar íconos por defecto
      delete this.L.Icon.Default.prototype._getIconUrl;
      this.L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Verificar ubicación seleccionada previa
      const savedLocation = this.locationSvc.getSelectedLocation();
      if (savedLocation) {
        this.currentLat = savedLocation.lat;
        this.currentLng = savedLocation.lon;
      } else {
        this.currentLat = this.initialLat;
        this.currentLng = this.initialLng;
      }

      // Crear mapa
      this.map = this.L.map(this.mapContainer.nativeElement, {
        center: [this.currentLat, this.currentLng],
        zoom: 14,
        zoomControl: true
      });

      // Agregar capa de tiles (OpenStreetMap)
      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // ✅ Evento moveend: detectar cuando el usuario termina de arrastrar el mapa
      this.map.on('moveend', () => {
        const center = this.map.getCenter();
        this.currentLat = center.lat;
        this.currentLng = center.lng;
        // Emitir al debouncer para reverse geocoding
        this.dragDebouncer$.next({ lat: center.lat, lng: center.lng });
      });

      this.loading.set(false);
      // ✅ Cargar dirección inicial (sin debounce, es la primera vez)
      this.updateAddressFromCoords(this.currentLat, this.currentLng);

    } catch (e) {
      console.error('Error al inicializar el mapa:', e);
      this.loading.set(false);
      this.locationError.set(this.i18n.t('map.errorLoadMap'));
    }
  }

  // ✅ Removido updateLocation(), ahora se usa debouncer directamente

  private updateAddressFromCoords(lat: number, lng: number): void {
    this.selectedAddress.set(this.i18n.t('mapPicker.fetchingAddress'));
    
    this.locationSvc.reverseGeocode(lat, lng).subscribe({
      next: (address) => {
        this.selectedAddress.set(address);
      },
      error: () => {
        this.selectedAddress.set(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    });
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set(this.i18n.t('mapPicker.geolocationUnsupported'));
      return;
    }

    this.loading.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // ✅ Solo centar el mapa (el pin está fijo en el centro)
        this.map?.setView([lat, lng], 15);
        this.currentLat = lat;
        this.currentLng = lng;
        this.updateAddressFromCoords(lat, lng);
        this.loading.set(false);
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        this.locationError.set(this.i18n.t('map.errorGeolocationFallback'));
        this.loading.set(false);
      }
    );
  }

  confirmLocation(): void {
    const suggestion: LocationSuggestion = {
      text: this.selectedAddress(),
      place_name: `${this.selectedAddress()}, Chile`,
      lat: this.currentLat,
      lon: this.currentLng
    };

    this.locationSelected.emit(suggestion);
  }

  cancelSelection(): void {
    this.closed.emit();
  }
}
